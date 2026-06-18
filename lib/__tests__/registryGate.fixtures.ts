import type { AuditReport, ContractArtifact, Vulnerability } from '../../types';
import type { PublishEligibilityInput } from '../registryGate';

export const VALID_HASH = 'a'.repeat(64);
export const OTHER_HASH = 'b'.repeat(64);

function vuln(severity: string, title = 'finding'): Vulnerability {
  return {
    severity: severity as Vulnerability['severity'],
    title,
    description: 'test finding',
    recommendation: 'review',
  };
}

export function baseAudit(overrides: Partial<AuditReport> = {}): AuditReport {
  const { deployment_allowed, ...rest } = overrides;
  return {
    score: 85,
    vulnerabilities: [],
    summary: 'ok',
    timestamp: Date.now(),
    metadata: { contract_hash: VALID_HASH, compile_success: true, dsl_passed: true, structural_score: 85 },
    ...rest,
    ...(deployment_allowed !== undefined ? { deployment_allowed } : {}),
  };
}

export function baseArtifact(): ContractArtifact {
  return {
    bytecode: '010203',
    constructorInputs: [],
    abi: [],
    contractName: 'Test',
  };
}

export const publishEligibilityFixtures: {
  name: string;
  input: PublishEligibilityInput;
  expectEligible: boolean;
  expectReasons: string[];
}[] = [
  {
    name: 'eligible baseline',
    input: {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit(),
      artifact: baseArtifact(),
      bytecode: '010203',
      sourceHash: VALID_HASH,
    },
    expectEligible: true,
    expectReasons: [],
  },
  {
    name: 'missing source',
    input: { auditReport: baseAudit(), artifact: baseArtifact(), bytecode: '010203' },
    expectEligible: false,
    expectReasons: ['missing_source'],
  },
  {
    name: 'missing audit',
    input: { sourceCode: 'contract X() {}', artifact: baseArtifact(), bytecode: '010203' },
    expectEligible: false,
    expectReasons: ['missing_audit'],
  },
  {
    name: 'missing artifact',
    input: { sourceCode: 'contract X() {}', auditReport: baseAudit(), bytecode: '010203' },
    expectEligible: false,
    expectReasons: ['missing_artifact'],
  },
  {
    name: 'missing bytecode',
    input: {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit(),
      artifact: { bytecode: '', constructorInputs: [], contractName: 'T', abi: [] },
    },
    expectEligible: false,
    expectReasons: ['missing_bytecode'],
  },
  {
    name: 'score too low',
    input: {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit({ score: 70 }),
      artifact: baseArtifact(),
      bytecode: '010203',
      sourceHash: VALID_HASH,
    },
    expectEligible: false,
    expectReasons: ['score_too_low'],
  },
  {
    name: 'score too low via total_score',
    input: {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit({ score: 70, total_score: 70 }),
      artifact: baseArtifact(),
      bytecode: '010203',
      sourceHash: VALID_HASH,
    },
    expectEligible: false,
    expectReasons: ['score_too_low'],
  },
  {
    name: 'stale audit hash',
    input: {
      sourceCode: 'contract X() {}',
      auditReport: baseAudit({
        metadata: { contract_hash: OTHER_HASH, compile_success: true, dsl_passed: true, structural_score: 85 },
      }),
      artifact: baseArtifact(),
      bytecode: '010203',
      sourceHash: VALID_HASH,
    },
    expectEligible: false,
    expectReasons: ['stale_audit'],
  },
];

export const normalizeNetworkFixtures: { input: string | undefined; expected: 'chipnet' | 'mainnet' }[] = [
  { input: 'mainnet', expected: 'mainnet' },
  { input: 'main', expected: 'mainnet' },
  { input: 'chipnet', expected: 'chipnet' },
  { input: 'testnet', expected: 'chipnet' },
  { input: 'BCH Chipnet', expected: 'chipnet' },
  { input: undefined, expected: 'chipnet' },
];

export const deriveValidationFixtures: { audit: AuditReport; expected: 'validated' | 'unsafe' }[] = [
  { audit: baseAudit({ score: 85 }), expected: 'validated' },
  { audit: baseAudit({ score: 70 }), expected: 'unsafe' },
  { audit: baseAudit({ vulnerabilities: [vuln('HIGH')] }), expected: 'unsafe' },
  { audit: baseAudit({ deployment_allowed: false, score: 95 }), expected: 'unsafe' },
];

export const deriveVisibilityFixtures: {
  score: number;
  vulns: AuditReport['vulnerabilities'];
  expected: 'community' | 'verified';
}[] = [
  { score: 92, vulns: [], expected: 'verified' },
  { score: 85, vulns: [], expected: 'community' },
  { score: 95, vulns: [vuln('HIGH')], expected: 'community' },
];

export const canDeployFixtures: { audit?: AuditReport; allowed: boolean }[] = [
  { audit: undefined, allowed: false },
  { audit: baseAudit({ score: 85 }), allowed: true },
  { audit: baseAudit({ score: 70 }), allowed: false },
  { audit: baseAudit({ deployment_allowed: false, score: 95 }), allowed: false },
  { audit: baseAudit({ vulnerabilities: [vuln('HIGH')] }), allowed: false },
];

export const bumpSemverFixtures: { input: string; expected: string }[] = [
  { input: '1.0.0', expected: '1.0.1' },
  { input: '2.3.9', expected: '2.3.10' },
  { input: 'bad', expected: '1.0.0' },
];

export { vuln };
