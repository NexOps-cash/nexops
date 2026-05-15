/**
 * Chipnet E2E: LinearVesting — fund → claim (2-output continuation) → revoke on continuation (no extra fund).
 *
 *   npx tsx scripts/chipnet-live-vesting-spend-paths.ts
 *   CHIPNET_TEST_WIF="<wif>" npx tsx scripts/chipnet-live-vesting-spend-paths.ts
 */
import { randomBytes } from 'node:crypto';
import { binToHex, decodePrivateKeyWif, encodePrivateKeyWif, instantiateSecp256k1 } from '@bitauth/libauth';
import { generate } from '../services/wizard/generator.ts';
import { vestingKind } from '../services/wizard/kinds/vesting.ts';
import { runChipnetLiveTest, type ChipnetLiveManifest } from '../services/chipnetLiveTest/runChipnetFlow.ts';

const POLL_MS = 240_000;

/** Schedule entirely in the past vs Chipnet wall clock for cliff + revoke. */
const START = 1_700_000_000;
const CLIFF = 1_700_003_600;
const END = 1_778_300_000;

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

async function main() {
    let wif = process.env.CHIPNET_TEST_WIF;
    if (!wif) {
        const pk = randomBytes(32);
        wif = encodePrivateKeyWif(new Uint8Array(pk), 'testnet');
        jsonl({ phase: 'wallet_generated', ok: true, wif, ts: Date.now() });
    }

    const gen = generate(vestingKind, {
        fields: {
            beneficiaryPk: pkPlaceholder('aa'),
            startTime: START,
            cliffTime: CLIFF,
            endTime: END,
            totalAmount: 100_000,
            adminPk: pkPlaceholder('bb'),
            adminEnabled: 1,
        },
        enabled: { adminRevocation: true },
    });
    if (gen.constraintErrors.length || Object.keys(gen.fieldErrors).length) {
        console.error(gen.constraintErrors, gen.fieldErrors);
        process.exit(2);
    }

    const pkHex = await pubkeyHexFromWif(wif);
    const constructorArgs = [
        pkHex,
        String(START),
        String(CLIFF),
        String(END),
        '100000',
        pkHex,
        '1',
    ];

    jsonl({
        phase: 'vesting_paths_start',
        ok: true,
        paths: ['claim', 'revoke'],
        schedule: { start: START, cliff: CLIFF, end: END },
        ts: Date.now(),
    });

    const claimManifest: ChipnetLiveManifest = {
        constructorArgs,
        functionName: 'claim',
        functionArgs: [''],
        fundContractSats: 8000,
        vestingContinuationSats: 5500,
    };

    const r1 = await runChipnetLiveTest({
        cashSource: gen.source,
        manifest: claimManifest,
        wif,
        pollTimeoutMs: POLL_MS,
        jsonlLog: jsonl,
    });
    jsonl({
        phase: 'vesting_path_summary',
        ok: r1.ok,
        functionName: 'claim',
        spendTxid: r1.spendTxid,
        error: r1.error,
        ts: Date.now(),
    });
    if (!r1.ok) process.exit(1);

    const revokeManifest: ChipnetLiveManifest = {
        constructorArgs,
        functionName: 'revoke',
        functionArgs: [''],
        skipContractFunding: true,
        minContractBalanceSats: 5500,
    };

    const r2 = await runChipnetLiveTest({
        cashSource: gen.source,
        manifest: revokeManifest,
        wif,
        pollTimeoutMs: POLL_MS,
        jsonlLog: jsonl,
    });
    jsonl({
        phase: 'vesting_path_summary',
        ok: r2.ok,
        functionName: 'revoke',
        spendTxid: r2.spendTxid,
        error: r2.error,
        ts: Date.now(),
    });
    if (!r2.ok) process.exit(1);

    jsonl({ phase: 'vesting_paths_done', ok: true, ts: Date.now() });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
