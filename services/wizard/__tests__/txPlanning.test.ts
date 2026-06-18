import { describe, expect, it } from 'vitest';
import {
  buildTxOutputs,
  CHIPNET_MIN_RELAY_FEE_SATS,
  deriveOutputStrategy,
  effectiveRelayFeeSats,
  escrowSellerExactInputPath,
  estimateChipnetRelayFootprintFeeSats,
  estimateFee,
  feeForStrategy,
} from '../txPlanning';
import type { ContractArtifact } from '../../../types';
import type { FunctionMeta } from '../parseContractMeta';

function meta(overrides: Partial<FunctionMeta> = {}): FunctionMeta {
  return {
    name: 'spend',
    role: 'owner-spend',
    invariants: [],
    ...overrides,
  };
}

const escrowArtifact = {
  contractName: 'ArbitrationEscrow',
  constructorInputs: [{ name: 'releaseCapSats' }, { name: 'buyerPk' }],
  bytecode: '00',
  abi: [],
} as ContractArtifact;

describe('txPlanning', () => {
  describe('deriveOutputStrategy', () => {
    it('maps roles and invariants to strategies', () => {
      expect(deriveOutputStrategy(meta({ role: 'quorum-spend' })).kind).toBe('sweep-to-wallet');
      expect(
        deriveOutputStrategy(meta({ role: 'covenant-continuation', invariants: ['VALUE_PRESERVING_COVENANT'] })).kind
      ).toBe('value-preserving-to-self');
      expect(
        deriveOutputStrategy(meta({ invariants: ['INPUT_OUTPUT_VALUE_MATCH'] })).kind
      ).toBe('exact-input-value-to-wallet');
      expect(deriveOutputStrategy(meta({ role: 'unknown-role' })).kind).toBe('unknown');
    });
  });

  describe('escrowSellerExactInputPath', () => {
    it('detects zero releaseCap escrow seller paths', () => {
      expect(escrowSellerExactInputPath(escrowArtifact, 'complete', ['0', '02'])).toBe(true);
      expect(escrowSellerExactInputPath(escrowArtifact, 'complete', ['1000', '02'])).toBe(false);
      expect(escrowSellerExactInputPath(escrowArtifact, 'refund', ['0', '02'])).toBe(false);
    });
  });

  describe('fee estimation', () => {
    it('estimateFee scales with inputs and outputs', () => {
      expect(estimateFee(1, 1)).toBe(344n);
      expect(estimateFee(2, 2)).toBe(678n);
    });

    it('exact-input strategy uses zero fee', () => {
      expect(feeForStrategy({ kind: 'exact-input-value-to-wallet' }, 1, 1)).toBe(0n);
    });

    it('chipnet relay floor applies for sweep spends', () => {
      const fee = effectiveRelayFeeSats({ kind: 'sweep-to-wallet' }, 1, 1, 'chipnet');
      expect(fee).toBeGreaterThanOrEqual(CHIPNET_MIN_RELAY_FEE_SATS);
      expect(fee).toBeGreaterThanOrEqual(estimateChipnetRelayFootprintFeeSats(1, 1));
    });

    it('skips chipnet floor for exact-input IOVM spends', () => {
      expect(effectiveRelayFeeSats({ kind: 'exact-input-value-to-wallet' }, 1, 1, 'chipnet')).toBe(0n);
    });
  });

  describe('buildTxOutputs', () => {
    it('sweeps to wallet minus fee', () => {
      const outs = buildTxOutputs({ kind: 'sweep-to-wallet' }, 10_000n, 500n, 'wallet', 'contract');
      expect(outs).toEqual([{ to: 'wallet', amount: 9500n }]);
    });

    it('preserves value to contract address for covenants', () => {
      const outs = buildTxOutputs({ kind: 'value-preserving-to-self' }, 5000n, 400n, 'wallet', 'contract');
      expect(outs).toEqual([{ to: 'contract', amount: 4600n }]);
    });

    it('exact-input sends full input value to wallet with zero fee', () => {
      const outs = buildTxOutputs({ kind: 'exact-input-value-to-wallet' }, 3000n, 0n, 'wallet', 'contract');
      expect(outs).toEqual([{ to: 'wallet', amount: 3000n }]);
    });

    it('rejects spends where fee exceeds input', () => {
      expect(() => buildTxOutputs({ kind: 'sweep-to-wallet' }, 100n, 200n, 'w', 'c')).toThrow(/Insufficient funds/);
    });

    it('rejects non-zero fee for exact-input strategy', () => {
      expect(() => buildTxOutputs({ kind: 'exact-input-value-to-wallet' }, 1000n, 1n, 'w', 'c')).toThrow(/zero fee/);
    });
  });
});
