// Exercises every wizard ContractKind with a range of feature toggles and compiles
// the generated CashScript source via cashc. Additionally enforces:
//   7a. Role allowlist   - every FunctionSpec.role is in kind.allowedRoles.
//   7b. Invariant coverage - parse generated source, match emitted invariants
//       against expected patterns per role + the @nexops-invariants comment.
//   7c. Static invariant table - only 'quorum-spend' may have an empty entry in
//       ROLE_INVARIANTS, and every rendered non-quorum function must emit >=1 invariant.
//
// Run:  npx tsx scripts/test-wizard-compile.mjs

import { compileString } from 'cashc';
import { KINDS } from '../services/wizard/kinds/index.ts';
import { generate } from '../services/wizard/generator.ts';
import { defaultValueForField } from '../services/wizard/schema.ts';
import {
  ROLE_INVARIANTS,
  TX_OUTPUT_ZERO_REGEX,
} from '../services/wizard/invariants.ts';

function stableHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function placeholderFor(field) {
  if (field.defaultValue !== undefined && field.defaultValue !== '') return field.defaultValue;
  switch (field.type) {
    case 'pubkey': {
      // Deterministically distinct 33-byte compressed pubkeys so the distinct-pubkey
      // cross-field validator on multisig/escrow/htlc kinds doesn't reject the combo.
      const slot = stableHash(field.id);
      return '02' + slot.repeat(8);
    }
    case 'bytes20':
      return stableHash(field.id).padEnd(40, 'a').slice(0, 40);
    case 'bytes32':
    case 'tokenCategory':
      return stableHash(field.id).padEnd(64, 'a').slice(0, 64);
    case 'bytes':
      return stableHash(field.id).padEnd(50, 'a').slice(0, 50);
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

// ---- Pass 7c (static): ROLE_INVARIANTS shape ----
const ROLE_STATIC_ERRORS = [];
for (const [role, ids] of Object.entries(ROLE_INVARIANTS)) {
  if (!Array.isArray(ids)) {
    ROLE_STATIC_ERRORS.push(`ROLE_INVARIANTS[${role}] is not an array.`);
    continue;
  }
  if (ids.length === 0 && role !== 'quorum-spend') {
    ROLE_STATIC_ERRORS.push(
      `Role "${role}" has an empty ROLE_INVARIANTS entry. Only 'quorum-spend' is allowed to be empty.`
    );
  }
}

// ---- Invariant-pattern expectations per role ----
const ROLE_PATTERNS = {
  'covenant-continuation': [
    /require\s*\(\s*tx\.outputs\.length\s*==\s*1\s*\)/,
    /require\s*\(\s*tx\.outputs\[0\]\.lockingBytecode\s*==\s*tx\.inputs\[this\.activeInputIndex\]\.lockingBytecode\s*\)/,
    /require\s*\(\s*tx\.outputs\[0\]\.value\s*==\s*tx\.inputs\[this\.activeInputIndex\]\.value\s*\)/,
  ],
  'bound-payout': [
    /require\s*\(\s*tx\.outputs\[0\]\.lockingBytecode\s*==\s*\w+\s*\)/,
    /require\s*\(\s*tx\.outputs\.length\s*<=\s*\d+\s*\)/,
    /require\s*\(\s*tx\.outputs\.length\s*>=\s*1\s*\)/,
  ],
  'owner-spend': [/require\s*\(\s*tx\.outputs\.length\s*<=\s*\d+\s*\)/],
  'owner-escape': [/require\s*\(\s*tx\.outputs\.length\s*<=\s*\d+\s*\)/],
  'token-mint': [
    /require\s*\(\s*tx\.outputs\.length\s*<=\s*\d+\s*\)/,
    /require\s*\(\s*tx\.outputs\[0\]\.tokenCategory\s*==\s*\w+\s*\)/,
    /require\s*\(\s*tx\.outputs\.length\s*>=\s*1\s*\)/,
  ],
  'quorum-spend': [],
};

function parseFunctions(source) {
  const funcs = [];
  const markerRe = /^\s*\/\/ @nexops-function (\w+): role=([\w-]+)\s*$/gm;
  const matches = [];
  let m;
  while ((m = markerRe.exec(source)) !== null) {
    matches.push({ name: m[1], role: m[2], index: m.index });
  }
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const chunk = source.slice(start, end);
    const invMatch = /^\s*\/\/ @nexops-invariants:\s*(.+)$/m.exec(chunk);
    const declared = invMatch
      ? invMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    // Body = after the `function ... {` line until matching close brace at function indent level.
    const fnStart = chunk.indexOf('function ');
    const bodyStart = chunk.indexOf('{', fnStart);
    const bodyEnd = chunk.lastIndexOf('}');
    const body = bodyStart >= 0 && bodyEnd > bodyStart
      ? chunk.slice(bodyStart + 1, bodyEnd)
      : '';
    funcs.push({ name: matches[i].name, role: matches[i].role, declared, body });
  }
  return funcs;
}

function patternsFor(role, declared) {
  const base = ROLE_PATTERNS[role] ?? [];
  const out = [...base];
  if (declared.includes('DISTINCT_PUBKEYS')) {
    out.push(/require\s*\(\s*\w+\s*!=\s*\w+\s*\)/);
  }
  return out;
}

let pass = 0;
let fail = 0;
const failures = [];

function recordFailure(kind, combo, reason, source) {
  fail += 1;
  failures.push({ kind: kind.id, combo, source, error: reason });
  console.log(`FAIL ${kind.id} ${JSON.stringify(combo)}: ${reason}`);
}

for (const kind of KINDS) {
  if (!Array.isArray(kind.allowedRoles) || kind.allowedRoles.length === 0) {
    ROLE_STATIC_ERRORS.push(`Kind "${kind.id}" is missing a non-empty allowedRoles.`);
  }

  const baseFields = buildFields(kind);
  const combos = featureCombos(kind.features);
  for (const combo of combos) {
    const enabledIds = Object.keys(combo).filter((k) => combo[k]);
    const conflict = enabledIds.some((id) => {
      const f = kind.features.find((x) => x.id === id);
      return f?.conflicts?.some((c) => combo[c]);
    });
    if (conflict) continue;

    const gen = generate(kind, { fields: baseFields, enabled: combo });
    if (Object.keys(gen.fieldErrors).length || gen.constraintErrors.length) {
      const details = [
        ...Object.entries(gen.fieldErrors).map(([k, v]) => `${k}: ${v}`),
        ...gen.constraintErrors,
      ].join('; ');
      recordFailure(kind, combo, `Wizard rejected valid placeholder combo: ${details}`, gen.source);
      continue;
    }

    // 7a. Role allowlist (static) using the kind's build output.
    let buildResult;
    try {
      buildResult = kind.build({ fields: baseFields, enabled: combo });
    } catch (e) {
      recordFailure(kind, combo, `build() threw: ${e.message}`, gen.source);
      continue;
    }
    let roleOk = true;
    for (const spec of buildResult.functions) {
      if (!spec.role) {
        recordFailure(kind, combo, `Function ${spec.name} has no role.`, gen.source);
        roleOk = false;
        break;
      }
      if (!kind.allowedRoles.includes(spec.role)) {
        recordFailure(
          kind,
          combo,
          `Function ${spec.name} has role "${spec.role}" not in allowedRoles [${kind.allowedRoles.join(',')}].`,
          gen.source
        );
        roleOk = false;
        break;
      }
    }
    if (!roleOk) continue;

    // Compile with cashc.
    try {
      const out = compileString(gen.source);
      if (!out.bytecode) throw new Error('No bytecode');
      // 7b + 7c. Invariant coverage + non-empty guard.
      const funcs = parseFunctions(gen.source);
      if (funcs.length !== buildResult.functions.length) {
        recordFailure(
          kind,
          combo,
          `Parsed ${funcs.length} functions from source, expected ${buildResult.functions.length}.`,
          gen.source
        );
        continue;
      }
      let invOk = true;
      for (const fn of funcs) {
        if (fn.role !== 'quorum-spend' && fn.declared.length === 0) {
          recordFailure(
            kind,
            combo,
            `Function ${fn.name} (role=${fn.role}) emitted zero invariants.`,
            gen.source
          );
          invOk = false;
          break;
        }
        const patterns = patternsFor(fn.role, fn.declared);
        for (const re of patterns) {
          if (!re.test(fn.body)) {
            recordFailure(
              kind,
              combo,
              `Function ${fn.name} (role=${fn.role}) missing expected invariant pattern ${re}.`,
              gen.source
            );
            invOk = false;
            break;
          }
        }
        if (!invOk) break;
        if (TX_OUTPUT_ZERO_REGEX.test(fn.body)) {
          if (!/require\s*\(\s*tx\.outputs\.length\s*(==|>=|<=)\s*\d+\s*\)/.test(fn.body)) {
            recordFailure(
              kind,
              combo,
              `Function ${fn.name} uses tx.outputs[0] without any outputs.length guard.`,
              gen.source
            );
            invOk = false;
            break;
          }
        }
      }
      if (!invOk) continue;

      pass += 1;
      console.log(`OK   ${kind.id} ${JSON.stringify(combo)} (ops ~${out.bytecode.split(/\s+/).length})`);
    } catch (e) {
      recordFailure(kind, combo, e.message, gen.source);
    }
  }
}

if (ROLE_STATIC_ERRORS.length) {
  console.log('\n--- STATIC ROLE / INVARIANT TABLE ERRORS ---');
  for (const err of ROLE_STATIC_ERRORS) console.log(`STATIC FAIL: ${err}`);
}

if (fail > 0) {
  console.log('\n--- FAILED SOURCES ---');
  for (const f of failures) {
    console.log(`\n# ${f.kind} ${JSON.stringify(f.combo)}\n# ERROR: ${f.error}\n${f.source}`);
  }
}

const staticFail = ROLE_STATIC_ERRORS.length;
console.log(`\nResult: ${pass} passed, ${fail} failed, ${staticFail} static issue(s).`);
process.exit(fail > 0 || staticFail > 0 ? 1 : 0);
