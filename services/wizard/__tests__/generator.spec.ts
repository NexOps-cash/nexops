import { generate } from '../generator';
import { KINDS } from '../kinds';
import { defaultValueForField } from '../schema';

interface SnapshotCase {
  kindId: string;
  mode: 'default' | 'all-on';
  hash: string;
  sourceHead: string;
}

function buildDefaultFields(kindId: string): Record<string, string | number | boolean> {
  const kind = KINDS.find((k) => k.id === kindId);
  if (!kind) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const field of kind.fields) out[field.id] = defaultValueForField(field);
  for (const feature of kind.features) {
    for (const field of feature.fields ?? []) out[field.id] = defaultValueForField(field);
  }
  return out;
}

function buildEnabled(kindId: string, allOn: boolean): Record<string, boolean> {
  const kind = KINDS.find((k) => k.id === kindId);
  if (!kind) return {};
  const out: Record<string, boolean> = {};
  for (const feature of kind.features) out[feature.id] = allOn && !feature.disabled;
  return out;
}

export function collectWizardSnapshots(): SnapshotCase[] {
  const rows: SnapshotCase[] = [];
  for (const kind of KINDS) {
    for (const mode of ['default', 'all-on'] as const) {
      const generated = generate(kind, {
        fields: buildDefaultFields(kind.id),
        enabled: buildEnabled(kind.id, mode === 'all-on'),
      });
      rows.push({
        kindId: kind.id,
        mode,
        hash: generated.hash,
        sourceHead: generated.source.slice(0, 120),
      });
    }
  }
  return rows;
}

// Snapshot payload intended for local verification or future test runner wiring.
export const WIZARD_GENERATOR_SNAPSHOTS: SnapshotCase[] = collectWizardSnapshots();
