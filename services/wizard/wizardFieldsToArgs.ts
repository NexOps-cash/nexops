import type { FieldDef } from './schema';

/**
 * Mirrors `fieldToParam` naming in generator.ts — param identifier segment after type keyword.
 * E.g. `pubkey pk1` → `pk1`; `bytes fooLockingBytecode` → `fooLockingBytecode`.
 */
export function fieldToConstructorParamName(field: FieldDef): string | null {
  if (field.buildOnly) return null;
  if (field.type === 'cashAddress') return `${field.id}LockingBytecode`;
  return field.id;
}

export function mapWizardFieldsToArgs(
  fieldDefs: FieldDef[],
  constructorInputs: { name: string }[],
  fields: Record<string, string | number | boolean>
): string[] {
  const paramToValue = new Map<string, string>();
  for (const def of fieldDefs) {
    const paramName = fieldToConstructorParamName(def);
    if (!paramName) continue;
    const v = fields[def.id];
    paramToValue.set(paramName, v !== undefined ? String(v) : '');
  }
  return constructorInputs.map((inp) => paramToValue.get(inp.name) ?? '');
}
