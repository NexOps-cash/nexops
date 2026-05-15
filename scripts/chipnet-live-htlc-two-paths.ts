/**
 * Chipnet smoke: HTLC claim then (separate deploy) refund — both INPUT_OUTPUT_VALUE_MATCH + CSV refund path.
 *
 * Usage:
 *   npx tsx scripts/chipnet-live-htlc-two-paths.ts
 *
 * Or reuse wallet:
 *   CHIPNET_TEST_WIF="<wif>" npx tsx scripts/chipnet-live-htlc-two-paths.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encodePrivateKeyWif } from '@bitauth/libauth';
import { runChipnetLiveTest } from '../services/chipnetLiveTest/runChipnetFlow.ts';

const cashPath = resolve('scripts/examples/htlc-hash160-minimal.cash');
const claimManifestPath = resolve('scripts/examples/htlc-claim-hash160.manifest.json');
const refundManifestPath = resolve('scripts/examples/htlc-refund-hash160.manifest.json');

const POLL_CLAIM_MS = 240_000;
/** Refund waits CSV + one extra tip block; manifests use timeoutHeight 1 */
const POLL_REFUND_MS = 1_800_000;

function jsonlLog(obj: Record<string, unknown>) {
    console.log(JSON.stringify(obj));
}

async function main() {
    const cashSource = readFileSync(cashPath, 'utf8');
    const claimManifest = JSON.parse(readFileSync(claimManifestPath, 'utf8'));
    const refundManifest = JSON.parse(readFileSync(refundManifestPath, 'utf8'));

    let wif = process.env.CHIPNET_TEST_WIF?.trim();
    if (!wif) {
        const pk = randomBytes(32);
        wif = encodePrivateKeyWif(new Uint8Array(pk), 'testnet');
        jsonlLog({ phase: 'wallet_generated', ok: true, wif, ts: Date.now() });
    }

    jsonlLog({ phase: 'htlc_paths_start', ok: true, paths: ['claim', 'refund'], ts: Date.now() });

    const claimResult = await runChipnetLiveTest({
        cashSource,
        manifest: claimManifest,
        wif,
        pollTimeoutMs: POLL_CLAIM_MS,
        injectPubkeyConstructorArgName: 'receiverPk',
        injectAllPubkeys: false,
        jsonlLog,
    });

    jsonlLog({
        phase: 'htlc_claim_summary',
        ok: claimResult.ok,
        spendTxid: claimResult.spendTxid,
        error: claimResult.error,
        ts: Date.now(),
    });

    if (!claimResult.ok) {
        process.exit(1);
    }

    const refundResult = await runChipnetLiveTest({
        cashSource,
        manifest: refundManifest,
        wif,
        pollTimeoutMs: POLL_REFUND_MS,
        injectPubkeyConstructorArgName: 'senderPk',
        injectAllPubkeys: false,
        jsonlLog,
    });

    jsonlLog({
        phase: 'htlc_refund_summary',
        ok: refundResult.ok,
        spendTxid: refundResult.spendTxid,
        error: refundResult.error,
        ts: Date.now(),
    });

    process.exit(refundResult.ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
