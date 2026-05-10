/**
 * Chipnet: HTLC claim() only (fast — no CSV wait).
 *
 *   npm run chipnet:live-test-htlc-claim
 *   CHIPNET_TEST_WIF="<wif>" npm run chipnet:live-test-htlc-claim
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encodePrivateKeyWif } from '@bitauth/libauth';
import { runChipnetLiveTest } from '../services/chipnetLiveTest/runChipnetFlow.ts';

const cashPath = resolve('scripts/examples/htlc-hash160-minimal.cash');
const manifestPath = resolve('scripts/examples/htlc-claim-hash160.manifest.json');
const POLL_MS = 240_000;

function jsonlLog(obj: Record<string, unknown>) {
    console.log(JSON.stringify(obj));
}

async function main() {
    const cashSource = readFileSync(cashPath, 'utf8');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    let wif = process.env.CHIPNET_TEST_WIF?.trim();
    if (!wif) {
        const pk = randomBytes(32);
        wif = encodePrivateKeyWif(new Uint8Array(pk), 'testnet');
        jsonlLog({ phase: 'wallet_generated', ok: true, wif, ts: Date.now() });
    }

    const r = await runChipnetLiveTest({
        cashSource,
        manifest,
        wif,
        pollTimeoutMs: POLL_MS,
        injectPubkeyConstructorArgName: 'receiverPk',
        injectAllPubkeys: false,
        jsonlLog,
    });

    jsonlLog({
        phase: 'htlc_claim_only_summary',
        ok: r.ok,
        spendTxid: r.spendTxid,
        error: r.error,
        ts: Date.now(),
    });

    process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
