/**
 * Chipnet E2E: ArbitrationEscrow — fund contract then spend via complete, arbitrateToBuyer, arbitrateToSeller.
 *
 *   npx tsx scripts/chipnet-live-escrow-spend-paths.ts
 *   CHIPNET_TEST_WIF="<wif>" npx tsx scripts/chipnet-live-escrow-spend-paths.ts
 *
 * Uses one burner key for buyer/seller/arbiter and locks buyer+seller bytecode to the same locking script
 * CashScript uses when paying the burner (token-aware address — not legacy 76a914…88ac from pubkey alone).
 */
import { randomBytes } from 'node:crypto';
import {
    binToHex,
    cashAddressToLockingBytecode,
    decodePrivateKeyWif,
    encodePrivateKeyWif,
    instantiateSecp256k1,
    instantiateRipemd160,
    sha256,
} from '@bitauth/libauth';
import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import { generate } from '../services/wizard/generator.ts';
import { escrowKind } from '../services/wizard/kinds/escrow.ts';
import {
    ELECTRUM_FALLBACK_SERVERS,
    getElectrumConnectionSnapshot,
} from '../services/blockchainService.ts';
import { getP2pkhBridgeArtifact } from '../services/chipnetLiveTest/p2pkhBridgeArtifact.ts';
import { runChipnetLiveTest, type ChipnetLiveManifest } from '../services/chipnetLiveTest/runChipnetFlow.ts';

const POLL_MS = 240_000;

function pkPlaceholder(h: string): string {
    return '02' + h.repeat(32);
}

function jsonl(obj: Record<string, unknown>) {
    console.log(JSON.stringify(obj));
}

async function pubkeyHexFromWif(wif: string): Promise<string> {
    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(decoded);
    const secp = await instantiateSecp256k1();
    const pub = secp.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pub === 'string') throw new Error(pub);
    return binToHex(pub);
}

/** Matches `burnerPaymentAddressFromWif` in runChipnetFlow (P2PKH bridge → token-aware Chipnet cash addr). */
async function burnerChipnetCashAddress(wif: string): Promise<string> {
    const host = getElectrumConnectionSnapshot().host ?? ELECTRUM_FALLBACK_SERVERS[0];
    const provider = new ElectrumNetworkProvider(Network.CHIPNET, { hostname: host });
    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(decoded);
    const secp = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();
    const pubkeyBytes = secp.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pubkeyBytes === 'string') throw new Error(pubkeyBytes);
    const pkh = ripemd160.hash(sha256.hash(pubkeyBytes));
    const p2pkh = new Contract(getP2pkhBridgeArtifact() as any, [pkh], { provider });
    return (p2pkh as { tokenAddress?: string }).tokenAddress ?? p2pkh.address;
}

function lockingBytecodeHexMatchingCashAddr(address: string): string {
    const r = cashAddressToLockingBytecode(address.trim());
    if (typeof r === 'string') throw new Error(r);
    return binToHex(r.bytecode);
}

async function main() {
    let wif = process.env.CHIPNET_TEST_WIF;
    if (!wif) {
        const pk = randomBytes(32);
        wif = encodePrivateKeyWif(new Uint8Array(pk), 'testnet');
        jsonl({ phase: 'wallet_generated', ok: true, wif, ts: Date.now() });
    }

    const fakeP2pkh = `76a914${'11'.repeat(20)}88ac`;
    const gen = generate(escrowKind, {
        fields: {
            buyerPk: pkPlaceholder('aa'),
            sellerPk: pkPlaceholder('bb'),
            arbiterPk: pkPlaceholder('cc'),
            buyerLockingBytecode: fakeP2pkh,
            sellerLockingBytecode: fakeP2pkh,
            releaseCapSats: 0,
        },
        enabled: {},
    });
    if (gen.constraintErrors.length || Object.keys(gen.fieldErrors).length) {
        console.error(gen.constraintErrors, gen.fieldErrors);
        process.exit(2);
    }

    const pkHex = await pubkeyHexFromWif(wif);
    const burnerAddr = await burnerChipnetCashAddress(wif);
    const lbHex = lockingBytecodeHexMatchingCashAddr(burnerAddr);
    jsonl({ phase: 'escrow_burner_locking', ok: true, burnerAddr, lockingBytecodeHexLen: lbHex.length, ts: Date.now() });
    const constructorArgs = [pkHex, pkHex, pkHex, lbHex, lbHex, '0'];

    const paths = ['complete', 'arbitrateToBuyer', 'arbitrateToSeller'] as const;

    jsonl({ phase: 'escrow_paths_start', ok: true, paths: [...paths], ts: Date.now() });

    for (const functionName of paths) {
        const manifest: ChipnetLiveManifest = {
            constructorArgs,
            functionName,
            functionArgs: ['', ''],
            fundContractSats: 2000,
        };
        const r = await runChipnetLiveTest({
            cashSource: gen.source,
            manifest,
            wif,
            pollTimeoutMs: POLL_MS,
            jsonlLog: jsonl,
        });
        jsonl({
            phase: 'escrow_path_summary',
            ok: r.ok,
            functionName,
            spendTxid: r.spendTxid,
            contractAddress: r.contractAddress,
            fundingTxid: r.fundingTxid,
            error: r.error,
            ts: Date.now(),
        });
        if (!r.ok) {
            process.exit(1);
        }
    }

    jsonl({ phase: 'escrow_paths_done', ok: true, ts: Date.now() });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
