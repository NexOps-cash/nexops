import { describe, expect, it } from 'vitest';
import * as libGate from '../registryGate';
import * as denoGate from '../../supabase/functions/_shared/registryGate';
import {
  baseAudit,
  baseArtifact,
  bumpSemverFixtures,
  deriveValidationFixtures,
  deriveVisibilityFixtures,
  normalizeNetworkFixtures,
  publishEligibilityFixtures,
  VALID_HASH,
} from './registryGate.fixtures';

const SHARED = [
  'normalizeRegistryNetwork',
  'normalizeAuditScore',
  'hasHighOrCriticalFindings',
  'isDeploymentAllowed',
  'evaluatePublishEligibility',
  'deriveValidationStatus',
  'deriveVisibility',
  'formatRejectionReason',
  'bumpSemverPatch',
] as const;

describe('registryGate lib vs Deno parity', () => {
  it('exports the same shared function set', () => {
    for (const name of SHARED) {
      expect(typeof (libGate as Record<string, unknown>)[name]).toBe('function');
      expect(typeof (denoGate as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('matches threshold constants', () => {
    expect(denoGate.MIN_PUBLISH_SCORE).toBe(libGate.MIN_PUBLISH_SCORE);
    expect(denoGate.MIN_DEPLOY_SCORE).toBe(libGate.MIN_DEPLOY_SCORE);
    expect(denoGate.VERIFIED_SCORE).toBe(libGate.VERIFIED_SCORE);
    expect(denoGate.REGISTRY_COMPILER_VERSION).toBe(libGate.REGISTRY_COMPILER_VERSION);
  });

  describe('normalizeRegistryNetwork', () => {
    for (const { input, expected } of normalizeNetworkFixtures) {
      it(String(input), () => {
        expect(denoGate.normalizeRegistryNetwork(input)).toBe(libGate.normalizeRegistryNetwork(input));
        expect(denoGate.normalizeRegistryNetwork(input)).toBe(expected);
      });
    }
  });

  describe('evaluatePublishEligibility', () => {
    for (const fixture of publishEligibilityFixtures) {
      it(fixture.name, () => {
        const lib = libGate.evaluatePublishEligibility(fixture.input);
        const deno = denoGate.evaluatePublishEligibility(fixture.input);
        expect(deno.eligible).toBe(lib.eligible);
        expect(deno.auditScore).toBe(lib.auditScore);
        expect(deno.rejectionReasons.sort()).toEqual(lib.rejectionReasons.sort());
      });
    }
  });

  describe('deriveValidationStatus', () => {
    for (const { audit } of deriveValidationFixtures) {
      it(`score ${audit.score}`, () => {
        expect(denoGate.deriveValidationStatus(audit)).toBe(libGate.deriveValidationStatus(audit));
      });
    }
  });

  describe('deriveVisibility', () => {
    for (const { score, vulns } of deriveVisibilityFixtures) {
      it(`score ${score}`, () => {
        expect(denoGate.deriveVisibility(score, vulns ?? [])).toBe(libGate.deriveVisibility(score, vulns ?? []));
      });
    }
  });

  describe('bumpSemverPatch', () => {
    for (const { input } of bumpSemverFixtures) {
      it(input, () => {
        expect(denoGate.bumpSemverPatch(input)).toBe(libGate.bumpSemverPatch(input));
      });
    }
  });

  it('computeSourceHash matches between bundles', async () => {
    const source = 'contract Parity() {}';
    const libHash = await libGate.computeSourceHash(source, libGate.REGISTRY_COMPILER_VERSION);
    const denoHash = await denoGate.computeSourceHash(source, denoGate.REGISTRY_COMPILER_VERSION);
    expect(denoHash).toBe(libHash);
    expect(denoHash).not.toBe(VALID_HASH);
  });

  it('formatRejectionReason strings match', () => {
    const reasons = ['missing_source', 'stale_audit', 'score_too_low'] as const;
    for (const r of reasons) {
      expect(denoGate.formatRejectionReason(r)).toBe(libGate.formatRejectionReason(r));
    }
  });

  it('artifact bytecode fallback behaves the same', () => {
    const input = {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit(),
      artifact: baseArtifact(),
    };
    const lib = libGate.evaluatePublishEligibility(input);
    const deno = denoGate.evaluatePublishEligibility(input);
    expect(deno.eligible).toBe(lib.eligible);
  });
});
