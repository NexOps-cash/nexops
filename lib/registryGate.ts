import type { AuditReport, ContractArtifact, Vulnerability } from '../types';

export const MIN_PUBLISH_SCORE = 80;
export const MIN_DEPLOY_SCORE = 80;
export const VERIFIED_SCORE = 90;
/** Must match publish-contract edge function and ProjectWorkspace publish payload. */
export const REGISTRY_COMPILER_VERSION = '^0.13.0';

/** DB + API network slug — maps project chain labels to allowed registry values. */
export function normalizeRegistryNetwork(chainOrNetwork?: string): 'chipnet' | 'mainnet' {
  const n = String(chainOrNetwork ?? '').toLowerCase().trim();
  if (n === 'mainnet' || n === 'main') return 'mainnet';
  if (n === 'chipnet' || n === 'testnet' || n.includes('chip') || n.includes('test')) return 'chipnet';
  return 'chipnet';
}

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

export interface DeployGateResult {
  allowed: boolean;
  score: number;
  reasons: string[];
}

export function normalizeAuditScore(auditReport?: AuditReport): number {
  if (!auditReport) return 0;
  const raw = auditReport.score ?? auditReport.total_score ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function isHighOrCriticalSeverity(severity: Vulnerability['severity']): boolean {
  const s = severity as string;
  return s === 'HIGH' || s === 'CRITICAL';
}

export function hasHighOrCriticalFindings(vulnerabilities: Vulnerability[] = []): boolean {
  return vulnerabilities.some((v) => isHighOrCriticalSeverity(v.severity));
}

export function countHighOrCritical(vulnerabilities: Vulnerability[] = []): number {
  return vulnerabilities.filter((v) => isHighOrCriticalSeverity(v.severity)).length;
}

/** Explicit true required; legacy audits without the flag infer from score + findings. */
export function isDeploymentAllowed(auditReport: AuditReport): boolean {
  if (auditReport.deployment_allowed === false) return false;
  if (auditReport.deployment_allowed === true) return true;
  const score = normalizeAuditScore(auditReport);
  return score >= MIN_DEPLOY_SCORE && !hasHighOrCriticalFindings(auditReport.vulnerabilities ?? []);
}

/** SHA-256 hex of source + compiler version (browser + Deno Web Crypto). */
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

export function normalizeHashForCompare(hash: string): string {
  return hash.trim().replace(/^0x/i, '').toLowerCase();
}

/** True when audit metadata has no trustworthy source binding (skip stale check). */
export function isUnboundContractHash(hash: string | undefined): boolean {
  if (!hash?.trim()) return true;
  const normalized = normalizeHashForCompare(hash);
  if (normalized === '...' || normalized.length < 64) return true;
  if (!/^[0-9a-f]{64}$/.test(normalized)) return true;
  return false;
}

/** Bind audit report to audited source for publish stale detection. */
export async function stampAuditWithSourceHash(
  report: AuditReport,
  sourceCode: string,
  compilerVersion: string = REGISTRY_COMPILER_VERSION
): Promise<AuditReport> {
  const contract_hash = await computeSourceHash(sourceCode.trim(), compilerVersion);
  return {
    ...report,
    metadata: {
      compile_success: report.metadata?.compile_success ?? true,
      dsl_passed: report.metadata?.dsl_passed ?? true,
      structural_score: report.metadata?.structural_score ?? normalizeAuditScore(report),
      semantic_score: report.metadata?.semantic_score,
      contract_hash,
    },
  };
}

export function getContractSourceFromProject(project: {
  contractCode: string;
  files: { name: string; content: string }[];
}): string {
  const cash = project.files.find((f) => f.name.endsWith('.cash'));
  return (cash?.content || project.contractCode || '').trim();
}

/**
 * Re-bind legacy audits (placeholder / external contract_hash) when the audit
 * still applies to the current source (no edits since audit timestamp).
 */
export async function resolveAuditReportForPublish(
  auditReport: AuditReport | undefined,
  sourceCode: string,
  lastModified: number,
  compilerVersion: string = REGISTRY_COMPILER_VERSION
): Promise<AuditReport | undefined> {
  if (!auditReport || !sourceCode.trim()) return auditReport;

  const sourceHash = await computeSourceHash(sourceCode, compilerVersion);
  const auditHash = auditReport.metadata?.contract_hash;

  if (
    auditHash &&
    !isUnboundContractHash(auditHash) &&
    normalizeHashForCompare(auditHash) === normalizeHashForCompare(sourceHash)
  ) {
    return auditReport;
  }

  if (auditReport.timestamp >= lastModified) {
    return stampAuditWithSourceHash(auditReport, sourceCode, compilerVersion);
  }

  return auditReport;
}

/** Minimum publish floor — must pass to insert any registry row. */
export function evaluatePublishEligibility(input: PublishEligibilityInput): PublishEligibilityResult {
  const rejectionReasons: PublishRejectionReason[] = [];
  const sourceCode = input.sourceCode?.trim() ?? '';
  const auditReport = input.auditReport;
  const auditScore = normalizeAuditScore(auditReport);

  if (!sourceCode) {
    rejectionReasons.push('missing_source');
  }
  if (!auditReport) {
    rejectionReasons.push('missing_audit');
  }
  if (!input.artifact) {
    rejectionReasons.push('missing_artifact');
  }
  const bytecode = input.bytecode?.trim() || input.artifact?.bytecode?.trim() || '';
  if (!bytecode) {
    rejectionReasons.push('missing_bytecode');
  }
  if (auditReport && (auditScore < 0 || auditScore > 100)) {
    rejectionReasons.push('invalid_audit_score');
  }
  if (auditReport && auditScore < MIN_PUBLISH_SCORE) {
    rejectionReasons.push('score_too_low');
  }

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

  return {
    eligible: rejectionReasons.length === 0,
    rejectionReasons,
    auditScore,
  };
}

/** After minimum floor — registry validation_status column value. */
export function deriveValidationStatus(auditReport: AuditReport): RegistryValidationStatus {
  const score = normalizeAuditScore(auditReport);
  const vulns = auditReport.vulnerabilities ?? [];
  if (score >= MIN_PUBLISH_SCORE && isDeploymentAllowed(auditReport) && !hasHighOrCriticalFindings(vulns)) {
    return 'validated';
  }
  return 'unsafe';
}

export function deriveVisibility(
  auditScore: number,
  vulnerabilities: Vulnerability[] = []
): RegistryVisibility {
  if (auditScore >= VERIFIED_SCORE && !hasHighOrCriticalFindings(vulnerabilities)) {
    return 'verified';
  }
  return 'community';
}

/** Deploy gate — same bar as validated status. */
export function canDeploy(auditReport?: AuditReport): DeployGateResult {
  const score = normalizeAuditScore(auditReport);
  const reasons: string[] = [];

  if (!auditReport) {
    reasons.push('No security audit on this contract.');
    return { allowed: false, score, reasons };
  }
  if (score < MIN_DEPLOY_SCORE) {
    reasons.push(`Audit score must be ${MIN_DEPLOY_SCORE}+ (current: ${score}).`);
  }
  if (!isDeploymentAllowed(auditReport)) {
    reasons.push('Deployment not allowed by audit gate (score, findings, or deployment_allowed).');
  }
  if (hasHighOrCriticalFindings(auditReport.vulnerabilities)) {
    reasons.push('HIGH or CRITICAL findings must be resolved before deploy.');
  }

  return {
    allowed: reasons.length === 0,
    score,
    reasons,
  };
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
