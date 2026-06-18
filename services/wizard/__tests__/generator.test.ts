import { describe, expect, it } from 'vitest';
import { collectWizardSnapshots } from './generator.spec.ts';

describe('wizard generator snapshots', () => {
  const snapshots = collectWizardSnapshots();

  it('covers every wizard kind in default and all-on modes', () => {
    expect(snapshots.length).toBeGreaterThan(0);
    const kindIds = new Set(snapshots.map((s) => s.kindId));
    expect(kindIds.size).toBeGreaterThanOrEqual(6);
    for (const kindId of kindIds) {
      expect(snapshots.some((s) => s.kindId === kindId && s.mode === 'default')).toBe(true);
      expect(snapshots.some((s) => s.kindId === kindId && s.mode === 'all-on')).toBe(true);
    }
  });

  it('produces stable non-empty hashes per snapshot', () => {
    for (const row of snapshots) {
      expect(row.hash, `${row.kindId}/${row.mode}`).toMatch(/^[a-f0-9]{64}$/);
      expect(row.sourceHead.length).toBeGreaterThan(20);
      expect(row.sourceHead).toContain('pragma');
    }
  });

  it('matches frozen snapshot table', () => {
    expect(snapshots).toMatchSnapshot();
  });
});
