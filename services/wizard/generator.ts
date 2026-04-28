import { binToHex, sha256, utf8ToBin } from '@bitauth/libauth';
import {
  BuildOptions,
  ContractKind,
  FeatureFlag,
  FieldDef,
  FunctionSpec,
  GeneratedContract,
  checkFeatureConstraints,
  collectFieldDefs,
  normalizeValue,
  validateAllFields,
} from './schema';
import { dedupeParams } from './blocks';
import {
  composeFunctionInvariants,
  FunctionRole,
  ROLE_INVARIANTS,
} from './invariants';

const COMPOSER_VERSION = 2;

function fieldToParam(field: FieldDef): string | null {
  if (field.buildOnly) return null;
  switch (field.type) {
    case 'pubkey':
      return `pubkey ${field.id}`;
    case 'bool':
    case 'int':
    case 'blockHeight':
    case 'unixTime':
      return `int ${field.id}`;
    case 'bytes':
      return `bytes ${field.id}`;
    case 'bytes20':
      return `bytes20 ${field.id}`;
    case 'bytes32':
    case 'tokenCategory':
      return `bytes32 ${field.id}`;
    case 'cashAddress':
      return `bytes ${field.id}LockingBytecode`;
    case 'enum':
    default:
      return `int ${field.id}`;
  }
}

function renderParams(fields: FieldDef[], extra: string[] = []): string {
  const mapped = fields.map(fieldToParam).filter((p): p is string => !!p);
  const ordered = dedupeParams([...mapped, ...extra]);
  return ordered.join(',\n    ');
}

function quoteLiteral(val: string | number | boolean): string {
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return Number.isFinite(val) ? String(Math.trunc(val)) : '0';
  const text = String(val);
  if (/^-?\d+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function renderMeta(fields: Record<string, string | number | boolean>): string {
  const entries = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '// No user fields configured.';
  return entries
    .map(([k, v]) => `// ${k}: ${quoteLiteral(v)}`)
    .join('\n');
}

export function quickLint(source: string): string[] {
  const warnings: string[] = [];
  const bytes = new TextEncoder().encode(source).length;
  const requires = (source.match(/\brequire\(/g) || []).length;
  const funcs = (source.match(/\bfunction\s+\w+/g) || []).length;
  const approxOps = requires * 3 + funcs * 5 + 10;

  if (bytes > 6000) warnings.push(`Contract source is large (${bytes} bytes).`);
  if (approxOps > 180) warnings.push(`Estimated opcode pressure is high (${approxOps}/201).`);
  if (source.includes('require(true);')) warnings.push('Contains placeholder guards; review before deployment.');
  return warnings;
}

function hashSource(source: string): string {
  return binToHex(sha256.hash(utf8ToBin(source)));
}

function selectedFeatures(kind: ContractKind, enabled: Record<string, boolean>): FeatureFlag[] {
  return kind.features.filter((feature) => enabled[feature.id]);
}

function indent(lines: string[], spaces = 8): string[] {
  const pad = ' '.repeat(spaces);
  return lines.map((l) => (l ? `${pad}${l}` : l));
}

function renderFunction(kind: ContractKind, spec: FunctionSpec): string[] {
  if (!ROLE_INVARIANTS[spec.role]) {
    throw new Error(`Unknown FunctionRole "${spec.role}" in ${kind.id}.${spec.name}`);
  }
  if (!kind.allowedRoles.includes(spec.role)) {
    throw new Error(
      `Role "${spec.role}" is not allowed in kind "${kind.id}" (allowedRoles: ${kind.allowedRoles.join(', ')}).`
    );
  }

  const bodyJoined = spec.body.join('\n');
  const composed = composeFunctionInvariants({
    role: spec.role,
    bodyJoined,
    extraInvariants: spec.extraInvariants,
    invariantParams: spec.invariantParams,
  });

  const header = `    function ${spec.name}(${spec.params.join(', ')}) {`;
  const body: string[] = [];
  body.push(`    // @nexops-function ${spec.name}: role=${spec.role}`);
  if (composed.ids.length) {
    body.push(`    // @nexops-invariants: ${composed.ids.join(',')}`);
  }
  body.push(header);
  body.push(...indent(composed.lines, 8));
  if (composed.lines.length && spec.body.length) body.push('');
  body.push(...indent(spec.body, 8));
  body.push('    }');
  return body;
}

export interface GenerateResult extends GeneratedContract {
  fieldErrors: Record<string, string>;
  constraintErrors: string[];
  params: string;
}

export function generate(kind: ContractKind, opts: BuildOptions): GenerateResult {
  const enabled = opts.enabled ?? {};
  const fields = opts.fields ?? {};
  const selected = selectedFeatures(kind, enabled);
  const constraintErrors = checkFeatureConstraints(kind, enabled);
  const visibleFields = collectFieldDefs(kind, enabled);
  const fieldErrors = validateAllFields(kind, enabled, fields);
  const normalized: Record<string, string | number | boolean> = {};
  for (const def of visibleFields) normalized[def.id] = normalizeValue(def, fields[def.id]);

  const _features = selected.map((f) => f.id);
  void _features;

  let built;
  try {
    built = kind.build({ fields: normalized, enabled });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    constraintErrors.push(message);
    built = { functions: [], warnings: [] };
  }

  const params = renderParams(visibleFields);
  const functionBlocks: string[] = [];
  try {
    for (const spec of built.functions) {
      functionBlocks.push(renderFunction(kind, spec).join('\n'));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!constraintErrors.includes(message)) constraintErrors.push(message);
  }

  const header = [
    'pragma cashscript ^0.13.0;',
    '',
    '// Generated by NexWizard v2 (UTXO composer)',
    `// @nexops-kind: ${kind.id}`,
    `// @nexops-composer-version: ${COMPOSER_VERSION}`,
    renderMeta(normalized),
    '',
  ];
  const body = [
    `contract ${kind.name}(`,
    `    ${params}`,
    ') {',
    functionBlocks.join('\n\n'),
    '}',
  ];
  const source = [...header, ...body].join('\n');

  const warnings = [...quickLint(source), ...(built.warnings ?? [])];
  return {
    source,
    hash: hashSource(source),
    warnings,
    fieldErrors,
    constraintErrors,
    params,
  };
}

export type { FunctionRole };
