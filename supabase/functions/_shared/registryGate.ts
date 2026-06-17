// Deno edge bundle — keep logic in sync with lib/registryGate.ts (no imports outside supabase/functions).

export const MIN_PUBLISH_SCORE = 80;
export const MIN_DEPLOY_SCORE = 80;
export const VERIFIED_SCORE = 90;
export const REGISTRY_COMPILER_VERSION = '^0.13.0';

export type RegistryValidationStatus = 'validated' | 'unsafe';
export type RegistryVisibility = 'community' | 'verified';

export type PublishRejectionReason =
  | 'missing_source'
  | 'missing_audit'
  | 'missing_artifact'
  | 'missing_bytecode'
  | 'score_too_low'
  | 'stale_audit'
  | 'invalid_audit_score';

interface Vulnerability {
  severity: string;
}

interface AuditReport {
  score?: number;
  total_score?: number;
  deployment_allowed?: boolean;
  vulnerabilities?: Vulnerability[];
  metadata?: { contract_hash?: string };
  timestamp?: number;
}

interface ContractArtifact {
  bytecode?: string;
}

export interface PublishEligibilityInput {
  sourceCode?: string;
  auditReport?: AuditReport;
  artifact?: ContractArtifact | null;
  bytecode?: string;
  sourceHash?: string;
  compilerVersion?: string;
}

export interface PublishEligibilityResult {
  eligible: boolean;
  rejectionReasons: PublishRejectionReason[];
  auditScore: number;
}

export function normalizeAuditScore(auditReport?: AuditReport): number {
  if (!auditReport) return 0;
  const raw = auditReport.score ?? auditReport.total_score ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function isHighOrCriticalSeverity(severity: string): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

export function hasHighOrCriticalFindings(vulnerabilities: Vulnerability[] = []): boolean {
  return vulnerabilities.some((v) => isHighOrCriticalSeverity(v.severity));
}

export function isDeploymentAllowed(auditReport: AuditReport): boolean {
  if (auditReport.deployment_allowed === false) return false;
  if (auditReport.deployment_allowed === true) return true;
  const score = normalizeAuditScore(auditReport);
  return score >= MIN_DEPLOY_SCORE && !hasHighOrCriticalFindings(auditReport.vulnerabilities ?? []);
}

export async function computeSourceHash(
  sourceCode: string,
  compilerVersion: string = REGISTRY_COMPILER_VERSION
): Promise<string> {
  const input = sourceCode + compilerVersion;
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeHashForCompare(hash: string): string {
  return hash.trim().replace(/^0x/i, '').toLowerCase();
}

function isUnboundContractHash(hash: string | undefined): boolean {
  if (!hash?.trim()) return true;
  const normalized = normalizeHashForCompare(hash);
  if (normalized === '...' || normalized.length < 64) return true;
  if (!/^[0-9a-f]{64}$/.test(normalized)) return true;
  return false;
}

export function evaluatePublishEligibility(input: PublishEligibilityInput): PublishEligibilityResult {
  const rejectionReasons: PublishRejectionReason[] = [];
  const sourceCode = input.sourceCode?.trim() ?? '';
  const auditReport = input.auditReport;
  const auditScore = normalizeAuditScore(auditReport);

  if (!sourceCode) rejectionReasons.push('missing_source');
  if (!auditReport) rejectionReasons.push('missing_audit');
  if (!input.artifact) rejectionReasons.push('missing_artifact');
  const bytecode = input.bytecode?.trim() || input.artifact?.bytecode?.trim() || '';
  if (!bytecode) rejectionReasons.push('missing_bytecode');
  if (auditReport && (auditScore < 0 || auditScore > 100)) rejectionReasons.push('invalid_audit_score');
  if (auditReport && auditScore < MIN_PUBLISH_SCORE) rejectionReasons.push('score_too_low');

  const contractHash = auditReport?.metadata?.contract_hash;
  const sourceHash = input.sourceHash?.trim();
  if (
    contractHash &&
    sourceHash &&
    !isUnboundContractHash(contractHash) &&
    normalizeHashForCompare(contractHash) !== normalizeHashForCompare(sourceHash)
  ) {
    rejectionReasons.push('stale_audit');
  }

  return { eligible: rejectionReasons.length === 0, rejectionReasons, auditScore };
}

export function deriveValidationStatus(auditReport: AuditReport): RegistryValidationStatus {
  const score = normalizeAuditScore(auditReport);
  const vulns = auditReport.vulnerabilities ?? [];
  if (score >= MIN_PUBLISH_SCORE && isDeploymentAllowed(auditReport) && !hasHighOrCriticalFindings(vulns)) {
    return 'validated';
  }
  return 'unsafe';
}

export function deriveVisibility(auditScore: number, vulnerabilities: Vulnerability[] = []): RegistryVisibility {
  if (auditScore >= VERIFIED_SCORE && !hasHighOrCriticalFindings(vulnerabilities)) return 'verified';
  return 'community';
}

export function formatRejectionReason(reason: PublishRejectionReason): string {
  switch (reason) {
    case 'missing_source':
      return 'Contract source code is required.';
    case 'missing_audit':
      return 'Run a security audit before publishing.';
    case 'missing_artifact':
      return 'Compiled artifact is required.';
    case 'missing_bytecode':
      return 'Bytecode is required.';
    case 'score_too_low':
      return `Audit score must be ${MIN_PUBLISH_SCORE}+ to publish.`;
    case 'stale_audit':
      return 'Audit is stale — re-run audit after code changes.';
    case 'invalid_audit_score':
      return 'Audit score is out of range (0–100).';
    default:
      return reason;
  }
}

export function bumpSemverPatch(version: string): string {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
    parts[2] += 1;
    return parts.join('.');
  }
  return '1.0.0';
}
