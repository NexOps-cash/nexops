import type { RegistryAuditLogEntry, RegistryContract, RegistryValidationStatus } from '../types';
import { supabase } from '../lib/supabase';

function mapRegistryRow(row: Record<string, unknown>): RegistryContract {
  return row as unknown as RegistryContract;
}

export async function fetchRegistryContracts(options?: {
  validationStatus?: RegistryValidationStatus;
  latestOnly?: boolean;
}): Promise<RegistryContract[]> {
  let q = supabase.from('contracts_registry').select('*').order('created_at', { ascending: false });

  if (options?.validationStatus) {
    q = q.eq('validation_status', options.validationStatus);
  }
  if (options?.latestOnly !== false) {
    q = q.eq('is_latest', true);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRegistryRow(row as Record<string, unknown>));
}

export async function fetchContractVersions(familyId: string): Promise<RegistryContract[]> {
  const { data, error } = await supabase
    .from('contracts_registry')
    .select('*')
    .eq('family_id', familyId)
    .order('version_number', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRegistryRow(row as Record<string, unknown>));
}

export async function fetchRegistryAuditLog(familyId: string, limit = 20): Promise<RegistryAuditLogEntry[]> {
  const { data, error } = await supabase
    .from('registry_audit_log')
    .select('*')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as RegistryAuditLogEntry[];
}
