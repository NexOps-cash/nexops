import { describe, expect, it } from 'vitest';
import {
  checkFeatureConstraints,
  validateAllFields,
  validateFieldValue,
} from '../schema';
import type { ContractKind, FieldDef } from '../schema';

const sampleKind: ContractKind = {
  id: 'test-kind',
  name: 'Test',
  summary: 'test',
  allowedRoles: ['owner-spend'],
  fields: [
    { id: 'amount', label: 'Amount', type: 'int', description: '' },
    { id: 'pk', label: 'PK', type: 'pubkey', description: '' },
  ],
  features: [
    {
      id: 'timing',
      label: 'Timing',
      group: 'Timing',
      description: '',
      requires: ['base'],
      conflicts: ['tokens'],
      fields: [{ id: 'lockTime', label: 'Lock', type: 'unixTime', description: '' }],
    },
    {
      id: 'base',
      label: 'Base',
      group: 'Policy',
      description: '',
    },
    {
      id: 'tokens',
      label: 'Tokens',
      group: 'Tokens',
      description: '',
    },
  ],
  build: () => ({ functions: [] }),
};

describe('wizard schema validation', () => {
  describe('validateFieldValue', () => {
    it('validates pubkey hex length', () => {
      const field: FieldDef = { id: 'pk', label: 'PK', type: 'pubkey', description: '' };
      expect(validateFieldValue(field, '02' + 'ab'.repeat(32)).valid).toBe(true);
      expect(validateFieldValue(field, 'not-hex').valid).toBe(false);
    });

    it('validates integers and unix time', () => {
      expect(validateFieldValue({ id: 'n', label: 'N', type: 'int', description: '' }, 42).valid).toBe(true);
      expect(validateFieldValue({ id: 'n', label: 'N', type: 'int', description: '' }, 'x').valid).toBe(false);
      expect(validateFieldValue({ id: 't', label: 'T', type: 'unixTime', description: '' }, 1).valid).toBe(true);
      expect(validateFieldValue({ id: 't', label: 'T', type: 'unixTime', description: '' }, 0).valid).toBe(false);
    });
  });

  describe('validateAllFields', () => {
    it('collects per-field errors for enabled features', () => {
      const errors = validateAllFields(sampleKind, { timing: true, base: true, tokens: false }, {
        amount: 10,
        pk: '02' + 'cd'.repeat(32),
        lockTime: 1_700_000_000,
      });
      expect(errors).toEqual({});
    });

    it('reports invalid feature field values', () => {
      const errors = validateAllFields(sampleKind, { timing: true, base: true }, {
        amount: 'bad',
        pk: '',
        lockTime: 0,
      });
      expect(errors.amount).toBeDefined();
      expect(errors.pk).toBeDefined();
      expect(errors.lockTime).toBeDefined();
    });
  });

  describe('checkFeatureConstraints', () => {
    it('detects missing required features', () => {
      const issues = checkFeatureConstraints(sampleKind, { timing: true, base: false });
      expect(issues.some((i) => i.includes('requires'))).toBe(true);
    });

    it('detects conflicting enabled features', () => {
      const issues = checkFeatureConstraints(sampleKind, { timing: true, base: true, tokens: true });
      expect(issues.some((i) => i.includes('conflicts'))).toBe(true);
    });
  });
});
