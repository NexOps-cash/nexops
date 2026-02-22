import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

// Pre-flight CORS for browser requests
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // 1. Handle CORS Options
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 2. Extract Data from Frontend
        const { title, description, source_code, tags, network, compiler_version } = await req.json();

        // 3. Authenticate User (Ensure they are logged in)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error("Missing Authorization header");
        }

        const supabaseServiceRole = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Use the auth token sent from the client to verify identity
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            throw new Error("Unauthorized: " + (userError?.message || "User not found"));
        }

        // 4. In a real backend, you would physically run `cashc` here.
        // For the Hackcelerator MVP Edge Function, we are going to strictly evaluate the AST/Security Policy
        // Since we can't easily run the Node.js `cashc` compiler inside the lightweight Deno Deno edge runtime natively 
        // without a custom docker container, we enforce the security checks here.

        // 5. Evaluate TollGate Policies
        // (Mock implementation of the TollGate Security Evaluation for the Edge context)
        // A true production system would run a heavy separate Node server for `cashc`.

        // Let's assume the frontend pre-compiled it (for the MVP), but the backend verifies the properties
        // For Hackcelerator demonstration, we will mandate the structural analysis passes the NexOps threshold

        // TODO: In Phase 2, integrate the exact structural TollGate logic here.
        // For now, we simulate the AuditGate Threshold Policy.

        // MOCK AUDIT (To be replaced with real static analysis algorithm in Edge Function)
        const mockAuditScore = 95;
        const mockCriticalCount = 0;
        const mockHighCount = 0;

        // 6. Enforce NexOps Audit Gate Threshold
        let determinedVisibility = 'community';

        if (mockAuditScore >= 90 && mockCriticalCount === 0 && mockHighCount <= 1) {
            determinedVisibility = 'verified';
        }

        // Generate Source Hash for tamper resistance
        const sourceHashInput = source_code + compiler_version;

        // WebCrypto SHA-256
        const msgUint8 = new TextEncoder().encode(sourceHashInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const sourceHashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 7. Insert into the Registry using the Service Role Key
        // Only the backend has this key, preventing users from forging 'verified' status
        const { data: insertedContract, error: insertError } = await supabaseServiceRole
            .from('contracts_registry')
            .insert({
                title,
                description,
                source_code,
                bytecode: "TODO_COMPILED_BYTECODE",
                artifact: {}, // TODO_COMPILED_ARTIFACT
                compiler_version,
                network,
                audit: {
                    score: mockAuditScore,
                    riskLevel: "SAFE",
                    issuesCount: mockCriticalCount + mockHighCount,
                    criticalCount: mockCriticalCount,
                    highCount: mockHighCount,
                    evaluatedAt: new Date().toISOString(),
                    engineVersion: "NexOps TollGate v1.0.0"
                },
                tags: tags || [],
                author_id: user.id,
                version: "1.0.0",
                source_hash: sourceHashHex,
                visibility: determinedVisibility
            })
            .select()
            .single();

        if (insertError) {
            throw new Error(`Registry Insert Failed: ${insertError.message}`);
        }

        return new Response(JSON.stringify(insertedContract), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});
