-- NexOps: optional workspace ↔ registry lineage
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS registry_family_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS registry_contract_id uuid;
