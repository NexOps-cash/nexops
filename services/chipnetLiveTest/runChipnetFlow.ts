/**
 * Chipnet live-test orchestration (CLI + future in-app “labs” UI).
 * Keeps faucet → fund contract → spend flow out of React.
 */

import { compileString } from 'cashc';
import {
    Contract,
    ElectrumNetworkProvider,
    Network,
    SignatureTemplate,
    TransactionBuilder as CashScriptTransactionBuilder,
} from 'cashscript';
import { decodePrivateKeyWif, instantiateSecp256k1, instantiateRipemd160, sha256 } from '@bitauth/libauth';
import type { ContractArtifact } from '../../types';
import { coerceConstructorArgs, deriveContractAddress } from '../addressService';
import {
    fetchUTXOs,
    getBlockHeight,
    requestFaucetFunds,
    getElectrumConnectionSnapshot,
    ELECTRUM_FALLBACK_SERVERS,
    type UTXO,
} from '../blockchainService';
import LocalWalletService from '../localWalletService';
import { parseFunctionMeta } from '../wizard/parseContractMeta';
import type { FunctionMeta } from '../wizard/parseContractMeta';
import {
    estimateFee,
    feeForStrategy,
    deriveOutputStrategy,
    buildTxOutputs,
    escrowSellerExactInputPath,
} from '../wizard/txPlanning';
import { coerceAbiFunctionArgs, getAbiFunction } from './coerceFunctionArgs';
import { attachBurnerP2pkhSponsorIfNeeded } from './exactInputValueMatchSponsor';
import { csvEncodedSequenceBlocks } from './csvSequence';
import { getP2pkhBridgeArtifact } from './p2pkhBridgeArtifact';

/** `estimateFee` undercounts large unlocking scripts; Chipnet returns code 66 below relay minimum. */
const CHIPNET_MIN_SPEND_FEE_SATS = 1200n;

export interface ChipnetLiveManifest {
    constructorArgs: string[];
    functionName: string;
    functionArgs: string[];
    /** Default 2000 — matches WizardDeployPanel default. */
    fundContractSats?: number;
    /**
     * LinearVesting `claim` only: value (sats) for continuation output[1] back to the contract.
     * Payout output[0] = contract input − this value; sponsor covers miner fee.
     */
    vestingContinuationSats?: number;
    /**
     * Skip burner→contract funding when the covenant already holds spendable sats (e.g. vesting
     * continuation). Avoids merging all burner UTXOs right before a sponsored spend (mempool conflict).
     */
    skipContractFunding?: boolean;
    /** When `skipContractFunding`, poll until sum(contract UTXOs) ≥ this (default 1). */
    minContractBalanceSats?: number;
}

export interface ChipnetLiveTestOptions {
    cashSource: string;
    manifest: ChipnetLiveManifest;
    /** Chipnet testnet WIF */
    wif: string;
    pollTimeoutMs: number;
    /** If set, overwrite manifest constructor arg with this name using burner pubkey hex */
    injectPubkeyConstructorArgName?: string | null;
    /** Fill every `pubkey` constructor slot with the burner pubkey (smoke-test multisig with one key). */
    injectAllPubkeys?: boolean;
    jsonlLog: (obj: Record<string, unknown>) => void;
}

export interface ChipnetLiveTestResult {
    ok: boolean;
    contractAddress?: string;
    fundingTxid?: string;
    spendTxid?: string;
    error?: string;
}

function chipnetProvider(): ElectrumNetworkProvider {
    const host = getElectrumConnectionSnapshot().host ?? ELECTRUM_FALLBACK_SERVERS[0];
    return new ElectrumNetworkProvider(Network.CHIPNET, { hostname: host });
}

function logPhase(
    jsonlLog: (o: Record<string, unknown>) => void,
    phase: string,
    ok: boolean,
    extra: Record<string, unknown> = {}
) {
    jsonlLog({ phase, ok, ts: Date.now(), ...extra });
}

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

async function pollUntil<T>(
    probe: () => Promise<T>,
    predicate: (v: T) => boolean,
    timeoutMs: number,
    intervalMs: number
): Promise<T> {
    const start = Date.now();
    let last: T | undefined;
    while (Date.now() - start < timeoutMs) {
        last = await probe();
        if (predicate(last)) return last;
        await sleep(intervalMs);
    }
    throw new Error(`Timeout after ${timeoutMs}ms (last=${JSON.stringify(last)})`);
}

function compileArtifact(source: string): ContractArtifact {
    const raw = compileString(source) as any;
    if (raw.errors?.length) {
        const msg = raw.errors.map((e: any) => (typeof e === 'string' ? e : e.message)).join('; ');
        throw new Error(`Compile failed: ${msg}`);
    }
    if (!raw.bytecode) {
        throw new Error('Compile failed: no bytecode');
    }
    return raw as ContractArtifact;
}

/** CashAddr where Chipnet faucet UTXOs must land — matches P2PKH Contract locking script (token-aware). */
async function burnerPaymentAddressFromWif(
    wif: string,
    provider: ElectrumNetworkProvider
): Promise<string> {
    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(decoded);

    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();
    const pubkeyBytes = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pubkeyBytes === 'string') throw new Error(pubkeyBytes);
    const pkh = ripemd160.hash(sha256.hash(pubkeyBytes));

    const p2pkh = new Contract(getP2pkhBridgeArtifact() as any, [pkh], { provider });
    return p2pkh.tokenAddress ?? p2pkh.address;
}

function applyInjectAllPubkeys(
    artifact: ContractArtifact,
    args: string[],
    pubkeyHex: string
): string[] {
    const next = [...args];
    while (next.length < artifact.constructorInputs.length) {
        next.push('');
    }
    for (let i = 0; i < artifact.constructorInputs.length; i += 1) {
        const t = artifact.constructorInputs[i]?.type?.toLowerCase();
        if (t === 'pubkey') {
            next[i] = pubkeyHex;
        }
    }
    return next;
}

function applyPubkeyInjection(
    artifact: ContractArtifact,
    args: string[],
    argName: string,
    pubkeyHex: string
): string[] {
    const idx = artifact.constructorInputs.findIndex((i) => i.name === argName);
    if (idx < 0) {
        throw new Error(`--inject-pubkey: no constructor input named "${argName}"`);
    }
    const next = [...args];
    while (next.length < artifact.constructorInputs.length) {
        next.push('');
    }
    next[idx] = pubkeyHex;
    return next;
}

async function fundContractFromBurnerP2pkh(params: {
    provider: ElectrumNetworkProvider;
    wif: string;
    burnerAddress: string;
    contractPaymentAddress: string;
    fundSats: bigint;
    utxos: UTXO[];
    jsonlLog: (o: Record<string, unknown>) => void;
}): Promise<string> {
    const { provider, wif, burnerAddress, contractPaymentAddress, fundSats, utxos } = params;

    if (utxos.length === 0) throw new Error('No burner UTXOs to fund contract');

    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(decoded);

    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();
    const pubkeyBytes = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pubkeyBytes === 'string') throw new Error(pubkeyBytes);
    const pkh = ripemd160.hash(sha256.hash(pubkeyBytes));

    const p2pkhArtifact = getP2pkhBridgeArtifact();

    const p2pkh = new Contract(p2pkhArtifact as any, [pkh], { provider });

    const signer = new SignatureTemplate(wif);
    const unlocker = p2pkh.unlock.spend(pubkeyBytes, signer);

    const totalIn = utxos.reduce((s, u) => s + BigInt(u.value), 0n);
    const fee = estimateFee(utxos.length, 2);
    const change = totalIn - fundSats - fee;
    if (change < 546n) {
        throw new Error(
            `Insufficient burner balance for funding + fee + dust change: totalIn=${totalIn} fundSats=${fundSats} fee=${fee}`
        );
    }

    const txBuilder = new CashScriptTransactionBuilder({ provider });
    utxos.forEach((u) => {
        txBuilder.addInput(
            {
                txid: u.txid,
                vout: u.vout,
                satoshis: BigInt(u.value),
            },
            unlocker
        );
    });
    txBuilder.addOutput({ to: contractPaymentAddress, amount: fundSats });
    txBuilder.addOutput({ to: burnerAddress, amount: change });

    params.jsonlLog({
        phase: 'fund_contract_tx_preview',
        ok: true,
        fundSats: fundSats.toString(),
        fee: fee.toString(),
        outputCount: 2,
        inputCount: utxos.length,
    });

    const built = await txBuilder.build();
    const signedHex = typeof built === 'string' ? built : (built as any).hex;
    const txid = await provider.sendRawTransaction(signedHex);
    return txid;
}

/**
 * Full Chipnet flow: compile → optional pubkey inject → derive address → faucet → fund → spend.
 */
export async function runChipnetLiveTest(opts: ChipnetLiveTestOptions): Promise<ChipnetLiveTestResult> {
    const {
        cashSource,
        manifest,
        wif,
        pollTimeoutMs,
        injectPubkeyConstructorArgName,
        injectAllPubkeys = false,
        jsonlLog,
    } = opts;

    try {
        const provider = chipnetProvider();

        const burnerAddress = await burnerPaymentAddressFromWif(wif, provider);
        const burnerPubkeyHex = await LocalWalletService.getPublicKeyFromWIF(wif);

        const t0 = Date.now();
        const artifact = compileArtifact(cashSource);
        logPhase(jsonlLog, 'compile', true, { ms: Date.now() - t0, contractName: artifact.contractName });

        let constructorStrings = [...manifest.constructorArgs];
        if (injectPubkeyConstructorArgName) {
            constructorStrings = applyPubkeyInjection(
                artifact,
                constructorStrings,
                injectPubkeyConstructorArgName,
                burnerPubkeyHex
            );
        }
        if (injectAllPubkeys) {
            constructorStrings = applyInjectAllPubkeys(artifact, constructorStrings, burnerPubkeyHex);
        }

        if (constructorStrings.length !== artifact.constructorInputs.length) {
            throw new Error(
                `constructorArgs length ${constructorStrings.length} !== artifact.constructorInputs ${artifact.constructorInputs.length}`
            );
        }

        const contractPaymentAddress = deriveContractAddress(artifact, constructorStrings, Network.CHIPNET);
        logPhase(jsonlLog, 'derive_contract_address', true, { contractPaymentAddress });

        const skipContractFunding = manifest.skipContractFunding === true;
        const fundContractSats = BigInt(manifest.fundContractSats ?? 2000);
        const minContractPollTotal =
            skipContractFunding ? BigInt(manifest.minContractBalanceSats ?? 1) : fundContractSats;
        /** Fund tx + typical sponsored IOVM spend (≤2 inputs); faucet grants ~10k but sequential legs reuse the wallet */
        const minBurnerBalance =
            (skipContractFunding ? 0n : fundContractSats) + estimateFee(1, 2) + estimateFee(2, 2) + 800n;

        const faucetRes = await requestFaucetFunds(burnerAddress);
        logPhase(jsonlLog, 'faucet_request', faucetRes.success, {
            txid: faucetRes.txid,
            detail: faucetRes.error,
        });
        if (!faucetRes.success) {
            throw new Error(faucetRes.error || 'Faucet failed');
        }

        await pollUntil(
            () => fetchUTXOs(burnerAddress),
            (us) => us.reduce((s, u) => s + BigInt(u.value), 0n) >= minBurnerBalance,
            pollTimeoutMs,
            2500
        );
        logPhase(jsonlLog, 'burner_funded', true, {
            minBalanceNeeded: minBurnerBalance.toString(),
            burnerPaymentAddress: burnerAddress,
        });

        const activeHost = getElectrumConnectionSnapshot().host ?? ELECTRUM_FALLBACK_SERVERS[0];

        let fundingTxid: string | undefined;
        if (!skipContractFunding) {
            const burnerUtxos = await fetchUTXOs(burnerAddress);
            const fundT0 = Date.now();
            fundingTxid = await fundContractFromBurnerP2pkh({
                provider,
                wif,
                burnerAddress,
                contractPaymentAddress,
                fundSats: fundContractSats,
                utxos: burnerUtxos,
                jsonlLog,
            });
            logPhase(jsonlLog, 'fund_contract_broadcast', true, {
                txid: fundingTxid,
                ms: Date.now() - fundT0,
            });
        } else {
            logPhase(jsonlLog, 'fund_contract_skipped', true, {
                minContractBalanceSats: minContractPollTotal.toString(),
            });
        }

        await pollUntil(
            () => fetchUTXOs(contractPaymentAddress),
            (us) => us.reduce((s, u) => s + BigInt(u.value), 0n) >= minContractPollTotal,
            pollTimeoutMs,
            2500
        );
        logPhase(jsonlLog, 'contract_funded', true, { skipContractFunding });

        const typedConstructorArgs = coerceConstructorArgs(artifact.constructorInputs, constructorStrings);
        const contract = new Contract(artifact as any, typedConstructorArgs, { provider }) as any;

        const abiFn = getAbiFunction(artifact, manifest.functionName);
        if (manifest.functionArgs.length !== abiFn.inputs.length) {
            throw new Error(
                `functionArgs length ${manifest.functionArgs.length} !== ABI inputs ${abiFn.inputs.length} for ${manifest.functionName}`
            );
        }
        const typedFnArgs = coerceAbiFunctionArgs(abiFn, manifest.functionArgs, wif);

        let contractUtxos = await fetchUTXOs(contractPaymentAddress);
        if (contractUtxos.length === 0) {
            throw new Error('No contract UTXOs after funding');
        }

        /** HTLC `refund()` requires mined CSV maturity relative to `timeoutHeight`. Absolute `nLocktime` caused Chipnet relay code 64 despite CSV-ready polls — maturity is enforced by `nSequence` alone. */
        let csvRefundSequence: number | undefined;
        if (manifest.functionName === 'refund' && artifact.contractName === 'HashTimeLock') {
            const ti = artifact.constructorInputs.findIndex((i) => i.name === 'timeoutHeight');
            if (ti < 0) {
                throw new Error('HashTimeLock refund requires timeoutHeight constructor argument');
            }
            const timeoutBlocks = Number(constructorStrings[ti]);
            if (!Number.isFinite(timeoutBlocks) || timeoutBlocks <= 0 || timeoutBlocks > 65535) {
                throw new Error(`Invalid timeoutHeight for CSV refund: ${constructorStrings[ti]}`);
            }
            csvRefundSequence = csvEncodedSequenceBlocks(timeoutBlocks);

            await pollUntil(
                () => fetchUTXOs(contractPaymentAddress),
                (us) => us.some((u) => u.height > 0 && BigInt(u.value) > 0n),
                pollTimeoutMs,
                2500
            );

            const mined = (await fetchUTXOs(contractPaymentAddress)).filter((u) => u.height > 0);
            const anchor = mined.sort((a, b) => b.value - a.value)[0];
            if (!anchor) {
                throw new Error('HTLC refund: no mined contract UTXO to anchor CSV maturity');
            }

            const targetTip = anchor.height + timeoutBlocks;
            /** Two blocks past CSV target avoids relay `non-BIP68-final` at boundary (Chipnet / Electrum height skew). */
            await pollUntil(
                () => getBlockHeight(),
                (tip) => tip >= targetTip + 2,
                pollTimeoutMs,
                2500
            );

            logPhase(jsonlLog, 'csv_refund_mature', true, {
                anchorHeight: anchor.height,
                timeoutBlocks,
                targetTip,
                tipNow: await getBlockHeight(),
            });

            contractUtxos = await fetchUTXOs(contractPaymentAddress);
            if (contractUtxos.length === 0) {
                throw new Error('No contract UTXOs after CSV maturity wait');
            }
        }

        const fnMeta: FunctionMeta =
            parseFunctionMeta(cashSource)[manifest.functionName] ?? {
                name: manifest.functionName,
                role: 'quorum-spend',
                invariants: [],
            };
        let outputStrategy = deriveOutputStrategy(fnMeta);
        if (
            outputStrategy.kind === 'sweep-to-wallet' &&
            escrowSellerExactInputPath(artifact, manifest.functionName, constructorStrings)
        ) {
            outputStrategy = { kind: 'exact-input-value-to-wallet' };
        }
        if (artifact.contractName === 'LinearVesting' && manifest.functionName === 'revoke') {
            outputStrategy = { kind: 'exact-input-value-to-wallet' };
        }

        const txBuilder = new CashScriptTransactionBuilder({ provider });
        const unlocker = contract.unlock[manifest.functionName](...typedFnArgs);

        contractUtxos.forEach((u) => {
            txBuilder.addInput(
                {
                    txid: u.txid,
                    vout: u.vout,
                    satoshis: BigInt(u.value),
                },
                unlocker,
                csvRefundSequence !== undefined ? { sequence: csvRefundSequence } : undefined
            );
        });

        const totalInput = contractUtxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
        const sweepDestination = burnerAddress;

        const isVestingClaim =
            artifact.contractName === 'LinearVesting' && manifest.functionName === 'claim';

        let outputs: Array<{ to: string; amount: bigint }>;
        let sponsorForce = false;
        let plannedFee = 0n;

        if (isVestingClaim) {
            const cont =
                manifest.vestingContinuationSats !== undefined ?
                    BigInt(manifest.vestingContinuationSats)
                :   0n;
            if (!manifest.vestingContinuationSats || cont < 546n) {
                throw new Error(
                    'LinearVesting claim requires manifest.vestingContinuationSats >= 546 (continuation dust)'
                );
            }
            if (cont >= totalInput) {
                throw new Error('vestingContinuationSats must be less than funded contract input');
            }
            const payout = totalInput - cont;
            if (payout < 546n) {
                throw new Error('LinearVesting claim payout would be below dust; lower continuation');
            }
            outputs = [
                { to: sweepDestination, amount: payout },
                { to: contract.address, amount: cont },
            ];
            outputStrategy = { kind: 'exact-input-value-to-wallet' };
            sponsorForce = true;
            plannedFee = 0n;
        } else {
            const outputCount = 1;
            const baseFee = feeForStrategy(outputStrategy, contractUtxos.length, outputCount);
            plannedFee =
                outputStrategy.kind === 'exact-input-value-to-wallet'
                    ? baseFee
                    : baseFee > CHIPNET_MIN_SPEND_FEE_SATS
                      ? baseFee
                      : CHIPNET_MIN_SPEND_FEE_SATS;
            outputs = buildTxOutputs(outputStrategy, totalInput, plannedFee, sweepDestination, contract.address);
        }

        const { sponsorInputValue } = await attachBurnerP2pkhSponsorIfNeeded({
            outputStrategy,
            txBuilder,
            provider,
            wif,
            burnerAddress,
            forceSponsor: sponsorForce,
            sponsorSizing: {
                covenantInputCount: contractUtxos.length,
                covenantOutputCount: outputs.length,
            },
        });

        outputs.forEach((o) => txBuilder.addOutput({ to: o.to, amount: o.amount }));

        /** LinearVesting enforces `tx.time >= cliffTime` / `>= endTime`; CashScript `tx.time` follows `nLocktime`. */
        if (artifact.contractName === 'LinearVesting') {
            const cliffIdx = artifact.constructorInputs.findIndex((i) => i.name === 'cliffTime');
            const endIdx = artifact.constructorInputs.findIndex((i) => i.name === 'endTime');
            if (manifest.functionName === 'claim' && cliffIdx >= 0) {
                const cliff = Number(constructorStrings[cliffIdx]);
                if (!Number.isFinite(cliff) || cliff < 500_000_000) {
                    throw new Error('LinearVesting claim: invalid cliffTime for locktime');
                }
                txBuilder.setLocktime(cliff);
            } else if (manifest.functionName === 'revoke' && endIdx >= 0) {
                const end = Number(constructorStrings[endIdx]);
                if (!Number.isFinite(end) || end < 500_000_000) {
                    throw new Error('LinearVesting revoke: invalid endTime for locktime');
                }
                txBuilder.setLocktime(end);
            }
        }

        /**
         * HashTimeLock `refund` uses CSV (`this.age`); mixed with sponsor input (`sequence` max), Chipnet
         * relay returned code 64 with `locktime: 0` — anchor locktime to current tip after maturity polls.
         */
        if (csvRefundSequence !== undefined && artifact.contractName === 'HashTimeLock') {
            txBuilder.setLocktime(await getBlockHeight());
        }

        const builtSpend = await txBuilder.build();
        const signedHex = typeof builtSpend === 'string' ? builtSpend : (builtSpend as any).hex;
        const outputTotal = outputs.reduce((sum, o) => sum + o.amount, 0n);
        const effectiveMinerFee = totalInput + sponsorInputValue - outputTotal;

        jsonlLog({
            phase: 'nexops:tx-plan',
            fnMeta,
            outputStrategy,
            outputs: outputs.map((o) => ({ to: o.to, amount: o.amount.toString() })),
            fee: plannedFee.toString(),
            totalInput: totalInput.toString(),
            csvRefundSequence:
                csvRefundSequence !== undefined ? String(csvRefundSequence) : undefined,
            vestingLocktime:
                artifact.contractName === 'LinearVesting' &&
                (manifest.functionName === 'claim' || manifest.functionName === 'revoke')
                    ? String(txBuilder.locktime)
                    : undefined,
            sponsorInputValue: sponsorInputValue.toString(),
            effectiveMinerFee: effectiveMinerFee.toString(),
            activeHost,
            ok: true,
            ts: Date.now(),
        });

        const spendT0 = Date.now();
        const spendTxid = await provider.sendRawTransaction(signedHex);
        logPhase(jsonlLog, 'spend_broadcast', true, { txid: spendTxid, ms: Date.now() - spendT0 });

        logPhase(jsonlLog, 'done', true, {
            contractPaymentAddress,
            fundingTxid,
            spendTxid,
        });

        return {
            ok: true,
            contractAddress: contractPaymentAddress,
            fundingTxid,
            spendTxid,
        };
    } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        logPhase(jsonlLog, 'fatal', false, { error: err, stack });
        return { ok: false, error: err };
    }
}
