import type { Project, RegistryContract } from '../types';
import { ChainType } from '../types';
import { ensureContractCodeAsCashFile } from './projectNormalize';

/** Map a `contracts_registry` row into a workspace `Project`. */
export function registryRowToProject(row: unknown): Project {
  const r = row as Record<string, unknown>;
  const code = String(r.source_code ?? r.code ?? '').trim();
  const rawName = String(r.title ?? r.name ?? '').trim();
  const name = rawName || 'Registry contract';
  const now = Date.now();
  const audit = r.audit as Project['auditReport'] | undefined;
  const base: Project = {
    id: crypto.randomUUID(),
    name,
    chain: ChainType.BCH_TESTNET,
    contractCode: code,
    files: [],
    versions: [],
    auditReport: audit,
    registryFamilyId: r.family_id ? String(r.family_id) : undefined,
    registryContractId: r.id ? String(r.id) : undefined,
    registryIntentDescription: r.intent_description ? String(r.intent_description) : undefined,
    lastModified: now,
  };
  return ensureContractCodeAsCashFile(base);
}

export function isRegistryContract(row: unknown): row is RegistryContract {
  if (!row || typeof row !== 'object') return false;
  const r = row as Record<string, unknown>;
  return typeof r.id === 'string' && typeof r.family_id === 'string';
}
