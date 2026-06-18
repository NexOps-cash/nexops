import { describe, expect, it } from 'vitest';
import { fieldToConstructorParamName, mapWizardFieldsToArgs } from '../wizardFieldsToArgs';
import type { FieldDef } from '../schema';

describe('wizardFieldsToArgs', () => {
  const fields: FieldDef[] = [
    { id: 'timeout', label: 'Timeout', type: 'int', description: '' },
    { id: 'buyerPk', label: 'Buyer', type: 'pubkey', description: '' },
    { id: 'buyerAddr', label: 'Buyer addr', type: 'cashAddress', description: '' },
    { id: 'internalOnly', label: 'Internal', type: 'bool', description: '', buildOnly: true },
  ];

  it('maps cashAddress fields to LockingBytecode param names', () => {
    expect(fieldToConstructorParamName(fields[2])).toBe('buyerAddrLockingBytecode');
    expect(fieldToConstructorParamName(fields[3])).toBeNull();
  });

  it('orders constructor args to match artifact inputs', () => {
    const args = mapWizardFieldsToArgs(
      fields,
      [{ name: 'buyerPk' }, { name: 'timeout' }, { name: 'buyerAddrLockingBytecode' }],
      {
        timeout: 100,
        buyerPk: '02abc',
        buyerAddr: 'bchtest:qexample',
        internalOnly: true,
      }
    );
    expect(args).toEqual(['02abc', '100', 'bchtest:qexample']);
  });

  it('fills missing mapped values with empty strings', () => {
    const args = mapWizardFieldsToArgs(fields, [{ name: 'buyerPk' }, { name: 'timeout' }], { buyerPk: '02x' });
    expect(args).toEqual(['02x', '']);
  });
});
