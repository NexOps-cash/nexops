-- Persist NexOps deployment_record (funding confirmed + identity ids) for Spend step after reload / sync
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deployment_record jsonb;
