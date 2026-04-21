export type FieldType =
  | 'pubkey'
  | 'int'
  | 'blockHeight'
  | 'unixTime'
  | 'bytes'
  | 'bytes20'
  | 'bytes32'
  | 'tokenCategory'
  | 'cashAddress'
  | 'enum'
  | 'bool';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  id: string;
  label: string;
  type: FieldType;
  description: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: FieldOption[];
  /** When true this field is used only to drive code generation and is NOT rendered as a constructor parameter. */
  buildOnly?: boolean;
}

export type FeatureGroup = 'Auth' | 'Timing' | 'Outputs' | 'Tokens' | 'Policy' | 'Info';

export interface FeatureFlag {
  id: string;
  label: string;
  group: FeatureGroup;
  description: string;
  requires?: string[];
  conflicts?: string[];
  fields?: FieldDef[];
  /** When this feature is enabled, drop these base-kind fields from the generated constructor. */
  removesFields?: string[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface BuildOptions {
  fields: Record<string, string | number | boolean>;
  enabled: Record<string, boolean>;
}

export interface GeneratedContract {
  source: string;
  hash: string;
  warnings: string[];
}

export interface ContractKind {
  id: string;
  name: string;
  summary: string;
  fields: FieldDef[];
  features: FeatureFlag[];
  build: (opts: BuildOptions) => GeneratedContract;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export type FieldValidator = (value: unknown, field: FieldDef) => ValidationResult;

const pubkeyRegex = /^(02|03)[0-9a-fA-F]{64}$|^04[0-9a-fA-F]{128}$/;
const bytes20Regex = /^[0-9a-fA-F]{40}$/;
const bytes32Regex = /^[0-9a-fA-F]{64}$/;
const evenHexRegex = /^[0-9a-fA-F]*$/;
const cashAddressRegex = /^(bitcoincash:)?(q|p)[a-z0-9]{41}$/i;

const isIntegerLike = (v: unknown): boolean => {
  if (typeof v === 'number') return Number.isInteger(v);
  if (typeof v !== 'string') return false;
  return /^-?\d+$/.test(v.trim());
};

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v.trim());
  return Number.NaN;
};

export const fieldValidators: Record<FieldType, FieldValidator> = {
  pubkey(value) {
    const text = String(value ?? '').trim();
    if (!text) return { valid: false, reason: 'Required public key.' };
    return pubkeyRegex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Public key must be 33-byte compressed or 65-byte uncompressed hex.' };
  },
  int(value) {
    return isIntegerLike(value)
      ? { valid: true }
      : { valid: false, reason: 'Must be an integer.' };
  },
  blockHeight(value) {
    if (!isIntegerLike(value)) return { valid: false, reason: 'Block height must be an integer.' };
    return toNumber(value) >= 0
      ? { valid: true }
      : { valid: false, reason: 'Block height must be >= 0.' };
  },
  unixTime(value) {
    if (!isIntegerLike(value)) return { valid: false, reason: 'Unix time must be an integer.' };
    return toNumber(value) > 0
      ? { valid: true }
      : { valid: false, reason: 'Unix time must be > 0.' };
  },
  bytes(value) {
    const text = String(value ?? '').trim();
    if (!text) return { valid: false, reason: 'Required hex bytes (even length).' };
    if (text.length % 2 !== 0) return { valid: false, reason: 'Hex string must have even length.' };
    return evenHexRegex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Expected hex characters only.' };
  },
  bytes20(value) {
    const text = String(value ?? '').trim();
    return bytes20Regex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Expected 20-byte hex (40 chars).' };
  },
  bytes32(value) {
    const text = String(value ?? '').trim();
    return bytes32Regex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Expected 32-byte hex (64 chars).' };
  },
  tokenCategory(value) {
    const text = String(value ?? '').trim();
    return bytes32Regex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Token category must be 32-byte hex (64 chars).' };
  },
  cashAddress(value) {
    const text = String(value ?? '').trim();
    return cashAddressRegex.test(text)
      ? { valid: true }
      : { valid: false, reason: 'Expected a valid CashAddress.' };
  },
  enum(value, field) {
    const text = String(value ?? '').trim();
    const options = field.options ?? [];
    if (!options.length) return { valid: true };
    return options.some((o) => o.value === text)
      ? { valid: true }
      : { valid: false, reason: 'Value must match one of the predefined options.' };
  },
  bool(value) {
    return typeof value === 'boolean'
      ? { valid: true }
      : { valid: false, reason: 'Value must be true or false.' };
  },
};

export function validateFieldValue(field: FieldDef, value: unknown): ValidationResult {
  const validator = fieldValidators[field.type];
  if (!validator) return { valid: true };
  return validator(value, field);
}

export function defaultValueForField(field: FieldDef): string | number | boolean {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'bool') return false;
  return '';
}

export function normalizeValue(field: FieldDef, value: unknown): string | number | boolean {
  if (field.type === 'int' || field.type === 'blockHeight' || field.type === 'unixTime') {
    if (value === '' || value === undefined || value === null) return '';
    const num = toNumber(value);
    return Number.isNaN(num) ? '' : Math.trunc(num);
  }
  if (field.type === 'bool') return value === true;
  return String(value ?? '').trim();
}

export function collectFieldDefs(kind: ContractKind, enabled: Record<string, boolean>): FieldDef[] {
  const activeFeatures = kind.features.filter((f) => enabled[f.id]);
  const removed = new Set<string>(activeFeatures.flatMap((f) => f.removesFields ?? []));
  const fromFeatures = activeFeatures.flatMap((f) => f.fields ?? []);
  const baseKept = kind.fields.filter((f) => !removed.has(f.id));
  return [...baseKept, ...fromFeatures];
}

export function validateAllFields(
  kind: ContractKind,
  enabled: Record<string, boolean>,
  values: Record<string, unknown>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of collectFieldDefs(kind, enabled)) {
    const out = validateFieldValue(field, values[field.id]);
    if (!out.valid) errors[field.id] = out.reason || 'Invalid value.';
  }
  return errors;
}

export function checkFeatureConstraints(
  kind: ContractKind,
  enabled: Record<string, boolean>
): string[] {
  const issues: string[] = [];
  for (const feature of kind.features) {
    if (!enabled[feature.id]) continue;
    for (const req of feature.requires ?? []) {
      if (!enabled[req]) issues.push(`Feature "${feature.label}" requires "${req}".`);
    }
    for (const conflict of feature.conflicts ?? []) {
      if (enabled[conflict]) issues.push(`Feature "${feature.label}" conflicts with "${conflict}".`);
    }
  }
  return issues;
}
