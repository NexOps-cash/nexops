-- NexOps: contracts_registry trust layer schema
-- Apply via Supabase SQL editor or supabase db push

CREATE TABLE IF NOT EXISTS public.contracts_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL,
  version text NOT NULL DEFAULT '1.0.0',
  version_number integer NOT NULL DEFAULT 1,
  is_latest boolean NOT NULL DEFAULT true,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  intent_description text,
  source_code text NOT NULL,
  bytecode text NOT NULL DEFAULT '',
  artifact jsonb NOT NULL DEFAULT '{}'::jsonb,
  compiler_version text NOT NULL DEFAULT '^0.13.0',
  network text NOT NULL DEFAULT 'chipnet',
  tags text[] NOT NULL DEFAULT '{}',
  audit jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_score integer NOT NULL DEFAULT 0,
  validation_status text NOT NULL DEFAULT 'validated',
  visibility text NOT NULL DEFAULT 'community',
  author_id uuid NOT NULL REFERENCES auth.users (id),
  author_display_name text,
  source_hash text NOT NULL,
  project_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_registry_validation_status_check
    CHECK (validation_status IN ('validated', 'unsafe')),
  CONSTRAINT contracts_registry_visibility_check
    CHECK (visibility IN ('community', 'verified')),
  CONSTRAINT contracts_registry_audit_score_check
    CHECK (audit_score >= 0 AND audit_score <= 100),
  CONSTRAINT contracts_registry_family_version_unique
    UNIQUE (family_id, version_number)
);

-- Extend existing deployments (table may pre-exist in hosted Supabase)
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS family_id uuid;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS version_number integer;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS is_latest boolean DEFAULT true;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS intent_description text;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS audit_score integer;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS validation_status text;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS author_display_name text;
ALTER TABLE public.contracts_registry ADD COLUMN IF NOT EXISTS project_id uuid;

UPDATE public.contracts_registry
SET
  family_id = COALESCE(family_id, id),
  version_number = COALESCE(version_number, 1),
  is_latest = COALESCE(is_latest, true),
  audit_score = COALESCE(audit_score, (audit->>'score')::integer, 0),
  validation_status = COALESCE(validation_status, 'validated')
WHERE family_id IS NULL OR version_number IS NULL OR audit_score IS NULL OR validation_status IS NULL;

ALTER TABLE public.contracts_registry ALTER COLUMN family_id SET NOT NULL;
ALTER TABLE public.contracts_registry ALTER COLUMN version_number SET NOT NULL;
ALTER TABLE public.contracts_registry ALTER COLUMN is_latest SET NOT NULL;
ALTER TABLE public.contracts_registry ALTER COLUMN audit_score SET NOT NULL;

CREATE INDEX IF NOT EXISTS contracts_registry_audit_score_idx
  ON public.contracts_registry (audit_score DESC);

CREATE INDEX IF NOT EXISTS contracts_registry_validation_status_idx
  ON public.contracts_registry (validation_status);

CREATE INDEX IF NOT EXISTS contracts_registry_visibility_idx
  ON public.contracts_registry (visibility);

CREATE INDEX IF NOT EXISTS contracts_registry_family_version_idx
  ON public.contracts_registry (family_id, version_number DESC);

CREATE UNIQUE INDEX IF NOT EXISTS contracts_registry_one_latest_per_family
  ON public.contracts_registry (family_id)
  WHERE is_latest = true;

ALTER TABLE public.contracts_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_registry_public_read" ON public.contracts_registry;
CREATE POLICY "contracts_registry_public_read"
  ON public.contracts_registry FOR SELECT
  USING (true);
