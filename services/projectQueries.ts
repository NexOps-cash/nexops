import type { Project } from '../types';
import { supabase } from '../lib/supabase';
import { ensureContractCodeAsCashFile } from '../lib/projectNormalize';

function mapRowToProject(row: Record<string, unknown>): Project {
  const raw: Project = {
    id: row.id as string,
    name: row.name as string,
    chain: row.chain as Project['chain'],
    contractCode: typeof row.contract_code === 'string' ? row.contract_code : String(row.contract_code ?? ''),
    files: (row.files as Project['files']) || [],
    versions: (row.versions as Project['versions']) || [],
    auditReport: row.audit_report as Project['auditReport'] | undefined,
    deployedAddress: row.deployed_address as string | undefined,
    lastModified:
      typeof row.last_modified === 'string'
        ? new Date(row.last_modified as string).getTime()
        : (row.last_modified as number),
  };
  return ensureContractCodeAsCashFile(raw);
}

/** Fetch one project — RLS must enforce owner-only visibility. */
export async function loadProjectByIdForUser(
  projectId: string,
  signal?: AbortSignal
): Promise<{ project: Project | null; error: Error | null }> {
  try {
    const q = supabase.from('projects').select('*').eq('id', projectId).maybeSingle();
    const { data, error } = await q;
    if (signal?.aborted) return { project: null, error: null };
    if (error) return { project: null, error: new Error(error.message) };
    if (!data) return { project: null, error: null };
    return { project: mapRowToProject(data as Record<string, unknown>), error: null };
  } catch (e) {
    return { project: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function loadProjectsForUser(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('last_modified', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapRowToProject(row as Record<string, unknown>));
}

export async function upsertProjectRow(project: Project, userId: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: userId,
      name: project.name,
      chain: project.chain,
      contract_code: project.contractCode,
      files: project.files,
      versions: project.versions,
      audit_report: project.auditReport,
      deployed_address: project.deployedAddress,
      last_modified: project.lastModified,
    });
    if (error) return { error: new Error(error.message) };
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}
