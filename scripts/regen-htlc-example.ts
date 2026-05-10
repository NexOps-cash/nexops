/**
 * Writes scripts/examples/htlc-hash160-minimal.cash from the wizard HTLC kind.
 * Run: npx tsx scripts/regen-htlc-example.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { instantiateRipemd160, sha256 } from '@bitauth/libauth';
import { generate } from '../services/wizard/generator.ts';
import { htlcKind } from '../services/wizard/kinds/htlc.ts';

const preimageAscii = 'nexops_htlc_smoke';

const pk = (h: string) => ('02' + h.repeat(32)) as string;

async function main() {
    const ripemd160 = await instantiateRipemd160();
    const digest20 = Buffer.from(
        ripemd160.hash(sha256.hash(new TextEncoder().encode(preimageAscii)))
    ).toString('hex');

    const fields = {
        senderPk: pk('aa'),
        receiverPk: pk('bb'),
        /** Minimum meaningful CSV height for Chipnet refund smoke tests */
        timeoutHeight: 1,
        digest20,
        digest32: '00'.repeat(32),
        hashMode: 0,
    };
    const r = generate(htlcKind, { fields, enabled: {} });
    const out = resolve('scripts/examples/htlc-hash160-minimal.cash');
    writeFileSync(out, r.source, 'utf8');
    console.log('Wrote', out);
    console.log('Preimage (claim manifest):', JSON.stringify(preimageAscii));
    console.log('digest20:', digest20);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
