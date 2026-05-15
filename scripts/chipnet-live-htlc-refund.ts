/**
 * Chipnet: HTLC refund() only — waits CSV maturity (manifest timeoutHeight; use "1" for minimum).
 *
 *   npm run chipnet:live-test-htlc-refund
 *   CHIPNET_TEST_WIF="<wif>" npm run chipnet:live-test-htlc-refund
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encodePrivateKeyWif } from '@bitauth/libauth';
import { runChipnetLiveTest } from '../services/chipnetLiveTest/runChipnetFlow.ts';

const cashPath = resolve('scripts/examples/htlc-hash160-minimal.cash');
const manifestPath = resolve('scripts/examples/htlc-refund-hash160.manifest.json');
/** timeoutHeight=1 waits mined funding + 1 CSV block + 1 relay slack block — allow Chipnet drift */
const POLL_MS = 1_800_000;

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
        injectPubkeyConstructorArgName: 'senderPk',
        injectAllPubkeys: false,
        jsonlLog,
    });

    jsonlLog({
        phase: 'htlc_refund_only_summary',
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
