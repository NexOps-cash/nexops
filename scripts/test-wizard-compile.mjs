// Exercises every wizard ContractKind with a range of feature toggles and compiles
// the generated CashScript source via cashc. Fails the process if any case fails.
//
// Run:  npx tsx scripts/test-wizard-compile.mjs

import { compileString } from 'cashc';
import { KINDS } from '../services/wizard/kinds/index.ts';
import { generate } from '../services/wizard/generator.ts';
import { defaultValueForField } from '../services/wizard/schema.ts';

function placeholderFor(field) {
    if (field.defaultValue !== undefined && field.defaultValue !== '') return field.defaultValue;
    switch (field.type) {
        case 'pubkey':
            return '02'.padEnd(66, 'a');
        case 'bytes20':
            return 'a'.repeat(40);
        case 'bytes32':
        case 'tokenCategory':
            return 'a'.repeat(64);
        case 'bytes':
            return 'a'.repeat(50);
        case 'int':
            return 1;
        case 'blockHeight':
            return 10;
        case 'unixTime':
            return 1_735_689_600;
        case 'bool':
            return false;
        case 'cashAddress':
            return 'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
        default:
            return defaultValueForField(field) || 1;
    }
}

function buildFields(kind) {
    const out = {};
    for (const f of kind.fields) out[f.id] = placeholderFor(f);
    for (const feat of kind.features) for (const f of (feat.fields ?? [])) out[f.id] = placeholderFor(f);
    return out;
}

function featureCombos(features) {
    const enabledFeatures = features.filter((f) => !f.disabled);
    const combos = [{}];
    for (const feat of enabledFeatures) {
        const next = [];
        for (const c of combos) {
            next.push({ ...c });
            next.push({ ...c, [feat.id]: true });
        }
        combos.length = 0;
        combos.push(...next);
    }
    return combos;
}

let pass = 0;
let fail = 0;
const failures = [];

for (const kind of KINDS) {
    const baseFields = buildFields(kind);
    const combos = featureCombos(kind.features);
    for (const combo of combos) {
        // Drop feature combos that conflict according to schema (cheap check)
        const enabledIds = Object.keys(combo).filter((k) => combo[k]);
        const conflict = enabledIds.some((id) => {
            const f = kind.features.find((x) => x.id === id);
            return f?.conflicts?.some((c) => combo[c]);
        });
        if (conflict) continue;

        const gen = generate(kind, { fields: baseFields, enabled: combo });
        if (Object.keys(gen.fieldErrors).length || gen.constraintErrors.length) {
            // Skip combos that the wizard itself marks invalid; this is expected.
            continue;
        }
        try {
            const out = compileString(gen.source);
            if (!out.bytecode) throw new Error('No bytecode');
            pass += 1;
            console.log(`OK   ${kind.id} ${JSON.stringify(combo)} (ops ~${out.bytecode.split(/\s+/).length})`);
        } catch (e) {
            fail += 1;
            failures.push({ kind: kind.id, combo, source: gen.source, error: e.message });
            console.log(`FAIL ${kind.id} ${JSON.stringify(combo)}: ${e.message}`);
        }
    }
}

if (fail > 0) {
    console.log('\n--- FAILED SOURCES ---');
    for (const f of failures) {
        console.log(`\n# ${f.kind} ${JSON.stringify(f.combo)}\n# ERROR: ${f.error}\n${f.source}`);
    }
}

console.log(`\nResult: ${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);
