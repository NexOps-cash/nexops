import { describe, expect, it } from 'vitest';
import type { Vulnerability } from '../../types';
import {
  bumpSemverPatch,
  canDeploy,
  computeSourceHash,
  deriveValidationStatus,
  deriveVisibility,
  evaluatePublishEligibility,
  formatRejectionReason,
  hasHighOrCriticalFindings,
  isDeploymentAllowed,
  isUnboundContractHash,
  normalizeAuditScore,
  normalizeHashForCompare,
  normalizeRegistryNetwork,
  REGISTRY_COMPILER_VERSION,
} from '../registryGate';
import {
  baseAudit,
  bumpSemverFixtures,
  canDeployFixtures,
  deriveValidationFixtures,
  deriveVisibilityFixtures,
  normalizeNetworkFixtures,
  publishEligibilityFixtures,
  OTHER_HASH,
  VALID_HASH,
  vuln,
} from './registryGate.fixtures';

describe('registryGate', () => {
  describe('normalizeRegistryNetwork', () => {
    for (const { input, expected } of normalizeNetworkFixtures) {
      it(`maps ${String(input)} → ${expected}`, () => {
        expect(normalizeRegistryNetwork(input)).toBe(expected);
      });
    }
  });

  describe('normalizeAuditScore', () => {
    it('returns 0 for missing report', () => {
      expect(normalizeAuditScore(undefined)).toBe(0);
    });

    it('clamps and rounds scores', () => {
      expect(normalizeAuditScore(baseAudit({ score: 84.6 }))).toBe(85);
      expect(normalizeAuditScore(baseAudit({ score: 101 }))).toBe(100);
    });
  });

  describe('hasHighOrCriticalFindings', () => {
    it('detects HIGH and CRITICAL', () => {
      expect(hasHighOrCriticalFindings([vuln('LOW')])).toBe(false);
      expect(hasHighOrCriticalFindings([vuln('HIGH')])).toBe(true);
      expect(
        hasHighOrCriticalFindings([
          { severity: 'CRITICAL', title: 'x', description: 'y', recommendation: 'z' } as unknown as Vulnerability,
        ])
      ).toBe(true);
    });
  });

  describe('isDeploymentAllowed', () => {
    it('respects explicit deployment_allowed flag', () => {
      expect(isDeploymentAllowed(baseAudit({ deployment_allowed: false }))).toBe(false);
      expect(isDeploymentAllowed(baseAudit({ deployment_allowed: true, score: 50 }))).toBe(true);
    });

    it('infers from score and findings when flag absent', () => {
      expect(isDeploymentAllowed(baseAudit({ score: 85 }))).toBe(true);
      expect(isDeploymentAllowed(baseAudit({ score: 70 }))).toBe(false);
    });
  });

  describe('hash helpers', () => {
    it('normalizes hashes for compare', () => {
      expect(normalizeHashForCompare('0x' + VALID_HASH.toUpperCase())).toBe(VALID_HASH);
    });

    it('detects unbound contract hashes', () => {
      expect(isUnboundContractHash(undefined)).toBe(true);
      expect(isUnboundContractHash('...')).toBe(true);
      expect(isUnboundContractHash(VALID_HASH)).toBe(false);
      expect(isUnboundContractHash(OTHER_HASH)).toBe(false);
    });

    it('computeSourceHash is deterministic', async () => {
      const a = await computeSourceHash('contract T() {}', REGISTRY_COMPILER_VERSION);
      const b = await computeSourceHash('contract T() {}', REGISTRY_COMPILER_VERSION);
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
    });
  });

  describe('evaluatePublishEligibility', () => {
    for (const fixture of publishEligibilityFixtures) {
      it(fixture.name, () => {
        const result = evaluatePublishEligibility(fixture.input);
        expect(result.eligible).toBe(fixture.expectEligible);
        for (const reason of fixture.expectReasons) {
          expect(result.rejectionReasons).toContain(reason);
        }
      });
    }
  });

  describe('deriveValidationStatus', () => {
    for (const { audit, expected } of deriveValidationFixtures) {
      it(`score ${audit.score} → ${expected}`, () => {
        expect(deriveValidationStatus(audit)).toBe(expected);
      });
    }
  });

  describe('deriveVisibility', () => {
    for (const { score, vulns, expected } of deriveVisibilityFixtures) {
      it(`score ${score} → ${expected}`, () => {
        expect(deriveVisibility(score, vulns ?? [])).toBe(expected);
      });
    }
  });

  describe('canDeploy', () => {
    for (const { audit, allowed } of canDeployFixtures) {
      it(`${allowed ? 'allows' : 'blocks'} ${audit?.score ?? 'no audit'}`, () => {
        expect(canDeploy(audit).allowed).toBe(allowed);
      });
    }
  });

  describe('formatRejectionReason', () => {
    it('maps known reasons to user strings', () => {
      expect(formatRejectionReason('missing_source')).toContain('source');
      expect(formatRejectionReason('stale_audit')).toContain('stale');
    });
  });

  describe('bumpSemverPatch', () => {
    for (const { input, expected } of bumpSemverFixtures) {
      it(`${input} → ${expected}`, () => {
        expect(bumpSemverPatch(input)).toBe(expected);
      });
    }
  });
});
