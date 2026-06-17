-- NexOps: transactional registry publish (version bump + single is_latest)
-- Called by publish-contract edge function with service role.

CREATE OR REPLACE FUNCTION public.publish_registry_contract(
  p_family_id uuid,
  p_is_new_family boolean,
  p_title text,
  p_description text,
  p_intent_description text,
  p_source_code text,
  p_bytecode text,
  p_artifact jsonb,
  p_compiler_version text,
  p_network text,
  p_tags text[],
  p_audit jsonb,
  p_audit_score integer,
  p_validation_status text,
  p_visibility text,
  p_author_id uuid,
  p_author_display_name text,
  p_source_hash text,
  p_project_id uuid,
  p_version text,
  p_version_number integer
)
RETURNS public.contracts_registry
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id uuid;
  v_row public.contracts_registry;
BEGIN
  IF p_validation_status NOT IN ('validated', 'unsafe') THEN
    RAISE EXCEPTION 'invalid validation_status: %', p_validation_status;
  END IF;
  IF p_visibility NOT IN ('community', 'verified') THEN
    RAISE EXCEPTION 'invalid visibility: %', p_visibility;
  END IF;
  IF p_audit_score < 0 OR p_audit_score > 100 THEN
    RAISE EXCEPTION 'invalid audit_score: %', p_audit_score;
  END IF;

  IF p_is_new_family THEN
    v_family_id := COALESCE(p_family_id, gen_random_uuid());
  ELSE
    v_family_id := p_family_id;
    PERFORM id FROM public.contracts_registry
    WHERE family_id = v_family_id
    FOR UPDATE;
    UPDATE public.contracts_registry
    SET is_latest = false
    WHERE family_id = v_family_id AND is_latest = true;
  END IF;

  INSERT INTO public.contracts_registry (
    family_id,
    version,
    version_number,
    is_latest,
    title,
    description,
    intent_description,
    source_code,
    bytecode,
    artifact,
    compiler_version,
    network,
    tags,
    audit,
    audit_score,
    validation_status,
    visibility,
    author_id,
    author_display_name,
    source_hash,
    project_id
  ) VALUES (
    v_family_id,
    p_version,
    p_version_number,
    true,
    p_title,
    COALESCE(p_description, ''),
    p_intent_description,
    p_source_code,
    COALESCE(p_bytecode, ''),
    COALESCE(p_artifact, '{}'::jsonb),
    p_compiler_version,
    p_network,
    COALESCE(p_tags, '{}'),
    p_audit,
    p_audit_score,
    p_validation_status,
    p_visibility,
    p_author_id,
    p_author_display_name,
    p_source_hash,
    p_project_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_registry_contract FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_registry_contract TO service_role;
