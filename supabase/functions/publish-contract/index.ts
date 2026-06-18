import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
import {
    evaluatePublishEligibility,
    deriveValidationStatus,
    deriveVisibility,
    computeSourceHash,
    normalizeAuditScore,
    bumpSemverPatch,
    formatRejectionReason,
    normalizeRegistryNetwork,
} from "../_shared/registryGate.ts"
// Audit report shape from client (MVP — server validates structure, not re-runs audit)
type AuditReportPayload = {
    score?: number;
    total_score?: number;
    deployment_allowed?: boolean;
    vulnerabilities?: { severity: string }[];
    metadata?: { contract_hash?: string };
    [key: string]: unknown;
};

// Pre-flight CORS for browser requests (Allow-Methods required or POST preflight fails → “Failed to send…”).
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    });
}

function authorDisplayName(user: { user_metadata?: Record<string, unknown>; email?: string }): string {
    const meta = user.user_metadata ?? {};
    const candidates = [
        meta.user_name,
        meta.preferred_username,
        meta.full_name,
        meta.name,
        user.email,
    ];
    for (const c of candidates) {
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
): Promise<void> {
    const { error } = await supabaseServiceRole.from('registry_audit_log').insert({
        contract_id: entry.contract_id ?? null,
        family_id: entry.family_id ?? null,
        actor_id: entry.actor_id,
        action: entry.action,
        details: entry.details,
    });
    if (error) {
        console.error('registry_audit_log insert failed:', error.message);
    }
}

function isUnauthorizedMessage(message: string): boolean {
    return /unauthorized|missing authorization|user not found|invalid jwt|jwt expired/i.test(message);
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        if (!supabaseUrl || !serviceRoleKey || !anonKey) {
            return jsonResponse({ error: 'Publish service is not configured.' }, 500);
        }

        let body: Record<string, unknown>;
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: 'Invalid JSON body.' }, 400);
        }

        const {
            title,
            description,
            source_code,
            tags,
            network,
            compiler_version,
            audit_report,
            artifact,
            bytecode,
            intent_description,
            project_id,
            family_id,
        } = body;

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return jsonResponse({ error: 'Missing Authorization header' }, 401);
        }
        const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
        if (!jwt) {
            return jsonResponse({ error: 'Missing Authorization header' }, 401);
        }

        const supabaseServiceRole = createClient(supabaseUrl, serviceRoleKey);

        const supabaseClient = createClient(
            supabaseUrl,
            anonKey,
            {
                global: { headers: { Authorization: authHeader } },
                auth: { persistSession: false },
            }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
        if (userError || !user) {
            return jsonResponse(
                { error: 'Unauthorized: ' + (userError?.message || 'User not found') },
                401
            );
        }

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
            compilerVersion,
        });

        if (!eligibility.eligible) {
            const reasons = eligibility.rejectionReasons.map(formatRejectionReason);
            await logRegistryAction(supabaseServiceRole, {
                actor_id: user.id,
                family_id: family_id ?? null,
                action: 'rejected',
                details: {
                    reasons: eligibility.rejectionReasons,
                    messages: reasons,
                    audit_score: eligibility.auditScore,
                    title: title ?? null,
                },
            });
            return jsonResponse({ error: reasons.join(' ') }, 400);
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

            if (latestErr) {
                throw new Error(`Version lookup failed: ${latestErr.message}`);
            }

            const prev = latestRows?.[0];
            versionNumber = (prev?.version_number ?? 0) + 1;
            versionSemver = bumpSemverPatch(String(prev?.version ?? '1.0.0'));
        }

        const { data: insertedContract, error: rpcError } = await supabaseServiceRole.rpc(
            'publish_registry_contract',
            {
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
            }
        );

        if (rpcError) {
            throw new Error(`Registry publish failed: ${rpcError.message}`);
        }

        const row = insertedContract as Record<string, unknown>;
        const logAction = isNewFamily ? 'published' : 'version_published';

        await logRegistryAction(supabaseServiceRole, {
            contract_id: String(row.id),
            family_id: String(row.family_id),
            actor_id: user.id,
            action: logAction,
            details: {
                audit_score: auditScore,
                validation_status: validationStatus,
                visibility,
                version: versionSemver,
                version_number: versionNumber,
            },
        });

        return jsonResponse(insertedContract as Record<string, unknown>, 200);

    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isUnauthorizedMessage(message)) {
            return jsonResponse({ error: message }, 401);
        }
        const status = /failed|lookup|publish/i.test(message) ? 500 : 400;
        return jsonResponse({ error: message }, status);
    }
});
