/**
 * Chipnet live contract test — faucet → fund contract → call function (burner WIF).
 *
 * Usage:
 *   npm run chipnet:live-test -- --cash path/to/c.cash --manifest path/to/manifest.json --wif "<chipnet-wif>"
 *   npm run chipnet:live-test -- --cash ... --manifest ... --generate-wallet
 *
 * Options:
 *   --inject-pubkey <constructorArgName>   Replace that constructor arg with burner pubkey hex
 *   --poll-timeout-ms <n>                  Default 180000
 *   --no-jsonl                             Pretty-print log objects (still JSON)
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encodePrivateKeyWif } from '@bitauth/libauth';
import {
    runChipnetLiveTest,
    type ChipnetLiveManifest,
} from '../services/chipnetLiveTest/runChipnetFlow.ts';

function parseArgv(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--generate-wallet') {
            out['generate-wallet'] = true;
            continue;
        }
        if (a === '--no-jsonl') {
            out['no-jsonl'] = true;
            continue;
        }
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith('--')) {
                throw new Error(`Missing value for --${key}`);
            }
            out[key] = next;
            i++;
        }
    }
    return out;
}

function main() {
    const args = parseArgv(process.argv);

    const cashPath = args.cash as string | undefined;
    const manifestPath = args.manifest as string | undefined;
    const pollTimeoutMs = args['poll-timeout-ms']
        ? Number(args['poll-timeout-ms'])
        : 180_000;
    const injectPubkey = (args['inject-pubkey'] as string) || null;
    const noJsonl = args['no-jsonl'] === true;

    let wif = args.wif as string | undefined;
    if (args['generate-wallet']) {
        if (wif) {
            console.error('Use either --wif or --generate-wallet, not both.');
            process.exit(2);
        }
        const pk = randomBytes(32);
        wif = encodePrivateKeyWif(new Uint8Array(pk), 'testnet');
    }

    if (!cashPath || !manifestPath || !wif) {
        console.error(
            'Required: --cash <file.cash> --manifest <file.json> and (--wif <wif> | --generate-wallet)'
        );
        process.exit(2);
    }

    const cashSource = readFileSync(resolve(cashPath), 'utf8');
    const manifestRaw = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as ChipnetLiveManifest;

    if (
        !manifestRaw.constructorArgs ||
        !Array.isArray(manifestRaw.constructorArgs) ||
        typeof manifestRaw.functionName !== 'string' ||
        !Array.isArray(manifestRaw.functionArgs)
    ) {
        console.error('Invalid manifest: need constructorArgs[], functionName, functionArgs[]');
        process.exit(2);
    }

    const jsonlLog = (obj: Record<string, unknown>) => {
        if (noJsonl) {
            console.log(JSON.stringify(obj, null, 2));
        } else {
            console.log(JSON.stringify(obj));
        }
    };

    if (args['generate-wallet']) {
        jsonlLog({
            phase: 'wallet_generated',
            ok: true,
            wif,
            hint: 'Save CHIPNET_TEST_WIF for reproducible runs; this wallet received faucet funds.',
            ts: Date.now(),
        });
    }

    runChipnetLiveTest({
        cashSource,
        manifest: manifestRaw,
        wif,
        pollTimeoutMs,
        injectPubkeyConstructorArgName: injectPubkey,
        jsonlLog,
    }).then((r) => {
        jsonlLog({
            phase: 'summary',
            ok: r.ok,
            contractAddress: r.contractAddress,
            fundingTxid: r.fundingTxid,
            spendTxid: r.spendTxid,
            error: r.error,
            ts: Date.now(),
        });
        process.exit(r.ok ? 0 : 1);
    });
}

main();
