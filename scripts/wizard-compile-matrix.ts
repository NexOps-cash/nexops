/**
 * Exhaustive CashScript compile check for every valid wizard feature combination.
 * Uses cashc ^0.13.0-next.7 (same as package.json).
 *
 * Run: npx tsx scripts/wizard-compile-matrix.ts
 */

import { compileString } from 'cashc';
import { KINDS } from '../services/wizard/kinds/index.ts';
import type { ContractKind } from '../services/wizard/schema.ts';
import {
  checkFeatureConstraints,
  collectFieldDefs,
  validateAllFields,
} from '../services/wizard/schema.ts';
import { generate } from '../services/wizard/generator.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPORT_PATH = resolve(__dirname, '../wizard-compile-matrix-report.md');

/** Unique compressed pubkeys for cross-field distinct validators. */
const PUBKEY_POOL = Array.from({ length: 48 }, (_, i) => {
  const body = i.toString(16).padStart(64, '0');
  return (i % 2 === 0 ? '02' : '03') + body;
});

let pubkeyCursor = 0;
function nextPubkey(): string {
  const p = PUBKEY_POOL[pubkeyCursor % PUBKEY_POOL.length];
  pubkeyCursor += 1;
  return p;
}

const HEX_BYTES_MIN = '76a914' + '11'.repeat(20) + '88ac';
const BYTES20_DUMMY = '33'.repeat(20);
const BYTES32_DUMMY = '44'.repeat(32);
const TOKEN_CAT_DUMMY = '55'.repeat(32);
const CASH_ADDR_DUMMY = `bitcoincash:q${'q'.repeat(41)}`;

function synthFields(kind: ContractKind, enabled: Record<string, boolean>): Record<string, string | number | boolean> {
  pubkeyCursor = 0;
  const defs = collectFieldDefs(kind, enabled);
  const values: Record<string, string | number | boolean> = {};

  for (const field of defs) {
    if (field.defaultValue !== undefined) {
      values[field.id] = field.defaultValue;
      continue;
    }
    switch (field.type) {
      case 'pubkey':
        values[field.id] = nextPubkey();
        break;
      case 'bool':
        values[field.id] = false;
        break;
      case 'int':
      case 'blockHeight':
        values[field.id] = field.type === 'blockHeight' ? 144 : 0;
        break;
      case 'unixTime':
        values[field.id] = 1_735_603_200;
        break;
      case 'bytes':
        values[field.id] = HEX_BYTES_MIN;
        break;
      case 'bytes20':
        values[field.id] = BYTES20_DUMMY;
        break;
      case 'bytes32':
        values[field.id] = BYTES32_DUMMY;
        break;
      case 'tokenCategory':
        values[field.id] = TOKEN_CAT_DUMMY;
        break;
      case 'cashAddress':
        values[field.id] = CASH_ADDR_DUMMY;
        break;
      case 'enum': {
        const first = field.options?.[0]?.value ?? '';
        values[field.id] = first;
        break;
      }
      default:
        values[field.id] = '';
    }
  }
  return values;
}

function allValidFeatureAssignments(kind: ContractKind): Record<string, boolean>[] {
  const toggles = kind.features.filter((f) => !f.disabled);
  const n = toggles.length;
  const out: Record<string, boolean>[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const enabled: Record<string, boolean> = {};
    let bi = 0;
    for (const f of kind.features) {
      if (f.disabled) enabled[f.id] = false;
      else {
        enabled[f.id] = (mask & (1 << bi)) !== 0;
        bi += 1;
      }
    }
    if (checkFeatureConstraints(kind, enabled).length === 0) out.push(enabled);
  }
  return out;
}

function describeVariation(kind: ContractKind, enabled: Record<string, boolean>): string {
  const enabledLabels = kind.features.filter((f) => enabled[f.id]).map((f) => f.label);
  const disabledLabels = kind.features.filter((f) => !f.disabled && !enabled[f.id]).map((f) => f.label);
  const parts: string[] = [];
  if (enabledLabels.length) parts.push(`**On:** ${enabledLabels.join('; ')}`);
  if (disabledLabels.length) parts.push(`**Off:** ${disabledLabels.join('; ')}`);
  return parts.length ? parts.join(' · ') : 'All optional features off.';
}

function compileSource(source: string): { ok: boolean; errors: string[] } {
  try {
    const raw = compileString(source) as { errors?: unknown[]; bytecode?: string };
    if (raw.errors?.length) {
      return {
        ok: false,
        errors: raw.errors.map((e) =>
          typeof e === 'string' ? e : String((e as { message?: string }).message ?? JSON.stringify(e))
        ),
      };
    }
    if (!raw.bytecode) return { ok: false, errors: ['Compilation produced no bytecode'] };
    return { ok: true, errors: [] };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

interface FailRow {
  templateId: string;
  templateName: string;
  variation: string;
  compileErrors: string[];
  wizardFieldErrors: string[];
  wizardConstraintErrors: string[];
  /** Full NexWizard-generated CashScript passed to cashc. */
  source: string;
}

function main(): void {
  const failures: FailRow[] = [];
  let total = 0;
  let compileOk = 0;

  const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
    dependencies?: { cashc?: string };
  };
  const cashcVer = pkg.dependencies?.cashc ?? '(unknown)';

  for (const kind of KINDS) {
    const assignments = allValidFeatureAssignments(kind);
    for (const enabled of assignments) {
      total += 1;
      const fields = synthFields(kind, enabled);
      const fieldErrMap = validateAllFields(kind, enabled, fields);
      const fieldErrList = Object.entries(fieldErrMap).map(([id, msg]) => `${id}: ${msg}`);
      const gen = generate(kind, { fields, enabled });

      const compileResult = compileSource(gen.source);
      if (compileResult.ok) {
        compileOk += 1;
      } else {
        failures.push({
          templateId: kind.id,
          templateName: kind.name,
          variation: describeVariation(kind, enabled),
          compileErrors: compileResult.errors,
          wizardFieldErrors: fieldErrList,
          wizardConstraintErrors: gen.constraintErrors,
          source: gen.source,
        });
      }
    }
  }

  const lines: string[] = [
    '# Wizard CashScript compile matrix (failures only)',
    '',
    `Generated by \`scripts/wizard-compile-matrix.ts\`.`,
    '',
    `- **cashc (package.json):** ${cashcVer}`,
    `- **Total valid feature combinations tested:** ${total}`,
    `- **Compiled OK:** ${compileOk}`,
    `- **Compile failures:** ${failures.length}`,
    '',
  ];

  if (failures.length === 0) {
    lines.push('All generated variations compiled successfully with CashScript.', '');
  } else {
    lines.push('## Failures', '');
    const normalizeCompileMsg = (m: string) => m.replace(/\s+at Line \d+, Column \d+\s*$/, '').trim();
    const uniqueMsgs = [...new Set(failures.flatMap((f) => f.compileErrors.map(normalizeCompileMsg)))];
    if (uniqueMsgs.length === 1) {
      lines.push(
        `**Summary:** All ${failures.length} failures share one compile error pattern after normalizing line numbers:`,
        '',
        `> ${uniqueMsgs[0]}`,
        ''
      );
    }
    let i = 1;
    for (const f of failures) {
      lines.push(`### ${i}. ${f.templateName} (\`${f.templateId}\`)`);
      lines.push('');
      lines.push(`**Variation:** ${f.variation}`);
      lines.push('');
      if (f.wizardFieldErrors.length) {
        lines.push('**Wizard field validation (synthetic fixtures — may indicate fixture gaps):**');
        lines.push('');
        for (const w of f.wizardFieldErrors) lines.push(`- ${w}`);
        lines.push('');
      }
      if (f.wizardConstraintErrors.length) {
        lines.push('**Wizard constraint messages from generator:**');
        lines.push('');
        for (const w of f.wizardConstraintErrors) lines.push(`- ${w}`);
        lines.push('');
      }
      lines.push('**CashScript compile errors:**');
      lines.push('');
      for (const e of f.compileErrors) lines.push(`- ${e}`);
      lines.push('');
      lines.push('**Generated source:**');
      lines.push('');
      lines.push('```cashscript');
      lines.push(f.source.trimEnd());
      lines.push('```');
      lines.push('');
      i += 1;
    }
  }

  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(`Total ${total}, compile OK ${compileOk}, failures ${failures.length}`);
}

main();
