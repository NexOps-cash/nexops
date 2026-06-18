/**
 * Single-file publish-contract for Supabase Dashboard → Edge Functions editor.
 * Paste this entire file as index.ts when the UI only allows one file.
 * (Repo CLI deploy uses index.ts + ../_shared/registryGate.ts instead.)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// --- registryGate (inlined for dashboard deploy) ---
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

const MIN_PUBLISH_SCORE = 80;
const MIN_DEPLOY_SCORE = 80;
const VERIFIED_SCORE = 90;
/** Must match publish-contract edge function and ProjectWorkspace publish payload. */
const REGISTRY_COMPILER_VERSION = '^0.13.0';

/** DB + API network slug — maps project chain labels to allowed registry values. */
function normalizeRegistryNetwork(chainOrNetwork?: string): 'chipnet' | 'mainnet' {
  const n = String(chainOrNetwork ?? '').toLowerCase().trim();
  if (n === 'mainnet' || n === 'main') return 'mainnet';
  if (n === 'chipnet' || n === 'testnet' || n.includes('chip') || n.includes('test')) return 'chipnet';
  return 'chipnet';
}

type RegistryValidationStatus = 'validated' | 'unsafe';
type RegistryVisibility = 'community' | 'verified';

type PublishRejectionReason =
  | 'missing_source'
  | 'missing_audit'
  | 'missing_artifact'
  | 'missing_bytecode'
  | 'score_too_low'
  | 'stale_audit'
  | 'invalid_audit_score';

interface PublishEligibilityInput {
  sourceCode?: string;
  auditReport?: AuditReport;
  artifact?: ContractArtifact | null;
  bytecode?: string;
  sourceHash?: string;
  compilerVersion?: string;
}

interface PublishEligibilityResult {
  eligible: boolean;
  rejectionReasons: PublishRejectionReason[];
  auditScore: number;
}

function normalizeAuditScore(auditReport?: AuditReport): number {
  if (!auditReport) return 0;
  const raw = auditReport.score ?? auditReport.total_score ?? 0;
  if (!Number.isFinite(raw)) return 0;
  return Math.round(Math.max(0, Math.min(100, raw)));
}

function isHighOrCriticalSeverity(severity: string): boolean {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

function hasHighOrCriticalFindings(vulnerabilities: Vulnerability[] = []): boolean {
  return vulnerabilities.some((v) => isHighOrCriticalSeverity(v.severity));
}

/** Explicit true required; legacy audits without the flag infer from score + findings. */
function isDeploymentAllowed(auditReport: AuditReport): boolean {
  if (auditReport.deployment_allowed === false) return false;
  if (auditReport.deployment_allowed === true) return true;
  const score = normalizeAuditScore(auditReport);
  return score >= MIN_DEPLOY_SCORE && !hasHighOrCriticalFindings(auditReport.vulnerabilities ?? []);
}

/** SHA-256 hex of source + compiler version (browser + Deno Web Crypto). */
async function computeSourceHash(
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

/** True when audit metadata has no trustworthy source binding (skip stale check). */
function isUnboundContractHash(hash: string | undefined): boolean {
  if (!hash?.trim()) return true;
  const normalized = normalizeHashForCompare(hash);
  if (normalized === '...' || normalized.length < 64) return true;
  if (!/^[0-9a-f]{64}$/.test(normalized)) return true;
  return false;
}

/** Minimum publish floor — must pass to insert any registry row. */
function evaluatePublishEligibility(input: PublishEligibilityInput): PublishEligibilityResult {
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
function deriveValidationStatus(auditReport: AuditReport): RegistryValidationStatus {
  const score = normalizeAuditScore(auditReport);
  const vulns = auditReport.vulnerabilities ?? [];
  if (score >= MIN_PUBLISH_SCORE && isDeploymentAllowed(auditReport) && !hasHighOrCriticalFindings(vulns)) {
    return 'validated';
  }
  return 'unsafe';
}

function deriveVisibility(
  auditScore: number,
  vulnerabilities: Vulnerability[] = []
): RegistryVisibility {
  if (auditScore >= VERIFIED_SCORE && !hasHighOrCriticalFindings(vulnerabilities)) {
    return 'verified';
  }
  return 'community';
}

function formatRejectionReason(reason: PublishRejectionReason): string {
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

function bumpSemverPatch(version: string): string {
  const parts = version.split('.').map((p) => parseInt(p, 10));
  if (parts.length >= 3 && parts.every((n) => !Number.isNaN(n))) {
    parts[2] += 1;
    return parts.join('.');
  }
  return '1.0.0';
}
// --- end registryGate ---

type AuditReportPayload = {
  score?: number;
  total_score?: number;
  deployment_allowed?: boolean;
  vulnerabilities?: { severity: string }[];
  metadata?: { contract_hash?: string };
  [key: string]: unknown;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function authorDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
  const meta = user.user_metadata ?? {};
  for (const c of [meta.user_name, meta.preferred_username, meta.full_name, meta.name, user.email]) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Anonymous';
}

async function logRegistryAction(
  supabaseServiceRole: ReturnType<typeof createClient>,
  entry: {
    contract_id?: string | null;
    family_id?: string | null;
    actor_id: string;
    action: 'published' | 'version_published' | 'rejected';
    details: Record<string, unknown>;
  }
) {
  await supabaseServiceRole.from('registry_audit_log').insert({
    contract_id: entry.contract_id ?? null,
    family_id: entry.family_id ?? null,
    actor_id: entry.actor_id,
    action: entry.action,
    details: entry.details,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      title, description, source_code, tags, network, compiler_version,
      audit_report, artifact, bytecode, intent_description, project_id, family_id,
    } = body;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Missing Authorization header");
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) throw new Error("Missing Authorization header");

    const supabaseServiceRole = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) throw new Error("Unauthorized: " + (userError?.message || "User not found"));

    const compilerVersion = String(compiler_version ?? '^0.13.0');
    const sourceCode = String(source_code ?? '').trim();
    const sourceHashHex = await computeSourceHash(sourceCode, compilerVersion);
    const auditReport = audit_report as AuditReportPayload | undefined;

    const eligibility = evaluatePublishEligibility({
      sourceCode,
      auditReport,
      artifact,
      bytecode: bytecode ?? artifact?.bytecode,
      sourceHash: sourceHashHex,
    });

    if (!eligibility.eligible) {
      const reasons = eligibility.rejectionReasons.map(formatRejectionReason);
      await logRegistryAction(supabaseServiceRole, {
        actor_id: user.id,
        family_id: family_id ?? null,
        action: 'rejected',
        details: { reasons: eligibility.rejectionReasons, messages: reasons, audit_score: eligibility.auditScore, title: title ?? null },
      });
      return new Response(JSON.stringify({ error: reasons.join(' ') }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const auditScore = normalizeAuditScore(auditReport);
    const validationStatus = deriveValidationStatus(auditReport!);
    const visibility = deriveVisibility(auditScore, auditReport!.vulnerabilities ?? []);

    const isNewFamily = !family_id;
    let versionNumber = 1;
    let versionSemver = '1.0.0';

    if (!isNewFamily) {
      const { data: latestRows, error: latestErr } = await supabaseServiceRole
        .from('contracts_registry')
        .select('version_number, version')
        .eq('family_id', family_id)
        .order('version_number', { ascending: false })
        .limit(1);
      if (latestErr) throw new Error(`Version lookup failed: ${latestErr.message}`);
      const prev = latestRows?.[0];
      versionNumber = (prev?.version_number ?? 0) + 1;
      versionSemver = bumpSemverPatch(String(prev?.version ?? '1.0.0'));
    }

    const { data: insertedContract, error: rpcError } = await supabaseServiceRole.rpc('publish_registry_contract', {
      p_family_id: family_id ?? null,
      p_is_new_family: isNewFamily,
      p_title: String(title ?? 'Untitled contract').trim(),
      p_description: String(description ?? '').trim(),
      p_intent_description: intent_description ? String(intent_description).trim() : null,
      p_source_code: sourceCode,
      p_bytecode: String(bytecode ?? artifact?.bytecode ?? ''),
      p_artifact: artifact ?? {},
      p_compiler_version: compilerVersion,
      p_network: normalizeRegistryNetwork(network),
      p_tags: Array.isArray(tags) ? tags : [],
      p_audit: auditReport,
      p_audit_score: auditScore,
      p_validation_status: validationStatus,
      p_visibility: visibility,
      p_author_id: user.id,
      p_author_display_name: authorDisplayName(user),
      p_source_hash: sourceHashHex,
      p_project_id: project_id ?? null,
      p_version: versionSemver,
      p_version_number: versionNumber,
    });

    if (rpcError) throw new Error(`Registry publish failed: ${rpcError.message}`);

    const row = insertedContract as Record<string, unknown>;
    await logRegistryAction(supabaseServiceRole, {
      contract_id: String(row.id),
      family_id: String(row.family_id),
      actor_id: user.id,
      action: isNewFamily ? 'published' : 'version_published',
      details: { audit_score: auditScore, validation_status: validationStatus, visibility, version: versionSemver, version_number: versionNumber },
    });

    return new Response(JSON.stringify(insertedContract), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
