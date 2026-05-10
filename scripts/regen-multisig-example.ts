/**
 * Writes scripts/examples/multisig-vault-minimal.cash from the wizard multisig kind.
 * Run: npx tsx scripts/regen-multisig-example.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generate } from '../services/wizard/generator.ts';
import { multisigKind } from '../services/wizard/kinds/multisig.ts';

const pk = (h: string) => ('02' + h.repeat(32)) as string;

const fields = {
    pk1: pk('11'),
    pk2: pk('22'),
    pk3: pk('33'),
    unlockTime: 0,
};
const r = generate(multisigKind, { fields, enabled: {} });
const out = resolve('scripts/examples/multisig-vault-minimal.cash');
writeFileSync(out, r.source, 'utf8');
console.log('Wrote', out);
