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
    requestFaucetFunds,
    getElectrumConnectionSnapshot,
    ELECTRUM_FALLBACK_SERVERS,
    type UTXO,
} from '../blockchainService';
import LocalWalletService from '../localWalletService';
import { parseFunctionMeta } from '../wizard/parseContractMeta';
import type { FunctionMeta } from '../wizard/parseContractMeta';
import { estimateFee, deriveOutputStrategy, buildTxOutputs } from '../wizard/txPlanning';
import { coerceAbiFunctionArgs, getAbiFunction } from './coerceFunctionArgs';

export interface ChipnetLiveManifest {
    constructorArgs: string[];
    functionName: string;
    functionArgs: string[];
    /** Default 2000 — matches WizardDeployPanel default. */
    fundContractSats?: number;
}

export interface ChipnetLiveTestOptions {
    cashSource: string;
    manifest: ChipnetLiveManifest;
    /** Chipnet testnet WIF */
    wif: string;
    pollTimeoutMs: number;
    /** If set, overwrite manifest constructor arg with this name using burner pubkey hex */
    injectPubkeyConstructorArgName?: string | null;
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

/** Canonical P2PKH bridge contract — must come from cashc, not hand-written bytecode. */
const P2PKH_BRIDGE_SOURCE = `pragma cashscript ^0.13.0;

contract P2PKH(bytes20 pkh) {
    function spend(pubkey pk, sig s) {
        require(hash160(pk) == pkh);
        require(checkSig(s, pk));
    }
}`;

let cachedP2pkhBridgeArtifact: ContractArtifact | null = null;

function getP2pkhBridgeArtifact(): ContractArtifact {
    if (!cachedP2pkhBridgeArtifact) {
        cachedP2pkhBridgeArtifact = compileArtifact(P2PKH_BRIDGE_SOURCE);
    }
    return cachedP2pkhBridgeArtifact;
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
    const { cashSource, manifest, wif, pollTimeoutMs, injectPubkeyConstructorArgName, jsonlLog } = opts;

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

        if (constructorStrings.length !== artifact.constructorInputs.length) {
            throw new Error(
                `constructorArgs length ${constructorStrings.length} !== artifact.constructorInputs ${artifact.constructorInputs.length}`
            );
        }

        const contractPaymentAddress = deriveContractAddress(artifact, constructorStrings, Network.CHIPNET);
        logPhase(jsonlLog, 'derive_contract_address', true, { contractPaymentAddress });

        const fundContractSats = BigInt(manifest.fundContractSats ?? 2000);
        const minBurnerBalance =
            fundContractSats + estimateFee(1, 2) + estimateFee(4, 2) + 3000n;

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

        const burnerUtxos = await fetchUTXOs(burnerAddress);
        const fundT0 = Date.now();
        const fundingTxid = await fundContractFromBurnerP2pkh({
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

        await pollUntil(
            () => fetchUTXOs(contractPaymentAddress),
            (us) => us.reduce((s, u) => s + BigInt(u.value), 0n) >= fundContractSats,
            pollTimeoutMs,
            2500
        );
        logPhase(jsonlLog, 'contract_funded', true, {});

        const typedConstructorArgs = coerceConstructorArgs(artifact.constructorInputs, constructorStrings);
        const contract = new Contract(artifact as any, typedConstructorArgs, { provider }) as any;

        const abiFn = getAbiFunction(artifact, manifest.functionName);
        if (manifest.functionArgs.length !== abiFn.inputs.length) {
            throw new Error(
                `functionArgs length ${manifest.functionArgs.length} !== ABI inputs ${abiFn.inputs.length} for ${manifest.functionName}`
            );
        }
        const typedFnArgs = coerceAbiFunctionArgs(abiFn, manifest.functionArgs, wif);

        const contractUtxos = await fetchUTXOs(contractPaymentAddress);
        if (contractUtxos.length === 0) {
            throw new Error('No contract UTXOs after funding');
        }

        const fnMeta: FunctionMeta =
            parseFunctionMeta(cashSource)[manifest.functionName] ?? {
                name: manifest.functionName,
                role: 'quorum-spend',
                invariants: [],
            };
        const outputStrategy = deriveOutputStrategy(fnMeta);

        const txBuilder = new CashScriptTransactionBuilder({ provider });
        const unlocker = contract.unlock[manifest.functionName](...typedFnArgs);

        contractUtxos.forEach((u) => {
            txBuilder.addInput(
                {
                    txid: u.txid,
                    vout: u.vout,
                    satoshis: BigInt(u.value),
                },
                unlocker
            );
        });

        const totalInput = contractUtxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
        const outputCount = 1;
        const fee = estimateFee(contractUtxos.length, outputCount);
        const sweepDestination = burnerAddress;

        const outputs = buildTxOutputs(outputStrategy, totalInput, fee, sweepDestination, contract.address);

        outputs.forEach((o) => txBuilder.addOutput({ to: o.to, amount: o.amount }));

        const builtSpend = await txBuilder.build();
        const signedHex = typeof builtSpend === 'string' ? builtSpend : (builtSpend as any).hex;

        jsonlLog({
            phase: 'nexops:tx-plan',
            fnMeta,
            outputStrategy,
            outputs: outputs.map((o) => ({ to: o.to, amount: o.amount.toString() })),
            fee: fee.toString(),
            totalInput: totalInput.toString(),
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
