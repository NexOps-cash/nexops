-- NexOps: registry action audit log
-- Apply via Supabase SQL editor or supabase db push

CREATE TABLE IF NOT EXISTS public.registry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts_registry (id) ON DELETE SET NULL,
  family_id uuid,
  actor_id uuid NOT NULL REFERENCES auth.users (id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT registry_audit_log_action_check
    CHECK (action IN ('published', 'version_published', 'rejected'))
);

CREATE INDEX IF NOT EXISTS registry_audit_log_family_id_idx
  ON public.registry_audit_log (family_id, created_at DESC);

CREATE INDEX IF NOT EXISTS registry_audit_log_actor_id_idx
  ON public.registry_audit_log (actor_id, created_at DESC);

ALTER TABLE public.registry_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "registry_audit_log_author_read" ON public.registry_audit_log;
CREATE POLICY "registry_audit_log_author_read"
  ON public.registry_audit_log FOR SELECT
  USING (auth.uid() = actor_id);
