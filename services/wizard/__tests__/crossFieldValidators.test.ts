import { describe, expect, it } from 'vitest';
import { makeDistinctPubkeyValidator } from '../crossFieldValidators';

describe('crossFieldValidators', () => {
  const distinct = makeDistinctPubkeyValidator(['buyerPk', 'sellerPk', 'arbiterPk']);

  it('returns no errors when pubkeys differ', () => {
    expect(
      distinct({} as never, {}, { buyerPk: '02aa', sellerPk: '02bb', arbiterPk: '02cc' })
    ).toEqual({});
  });

  it('flags duplicate pubkey on second field id', () => {
    const errors = distinct({} as never, {}, { buyerPk: '02AA', sellerPk: '02aa', arbiterPk: '03cc' });
    expect(errors.sellerPk).toContain('buyerPk');
    expect(errors.buyerPk).toBeUndefined();
  });

  it('ignores empty values', () => {
    expect(distinct({} as never, {}, { buyerPk: '', sellerPk: '02bb' })).toEqual({});
  });
});
