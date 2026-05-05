import type { Project } from '../types';
import { ChainType } from '../types';
import { ensureContractCodeAsCashFile } from './projectNormalize';

/** Map a `contracts_registry` row into a workspace `Project`. */
export function registryRowToProject(row: unknown): Project {
  const r = row as Record<string, unknown>;
  const code = String(r.source_code ?? r.code ?? '').trim();
  const rawName = String(r.title ?? r.name ?? '').trim();
  const name = rawName || 'Registry contract';
  const now = Date.now();
  const base: Project = {
    id: crypto.randomUUID(),
    name,
    chain: ChainType.BCH_TESTNET,
    contractCode: code,
    files: [],
    versions: [],
    lastModified: now,
  };
  return ensureContractCodeAsCashFile(base);
}
