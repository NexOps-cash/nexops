import { supabase } from './supabase';

/** Full row — survives OAuth redirect when stay on same origin (localhost, app.nexops.cash). */
export const REGISTRY_PENDING_SESSION_KEY = 'nexops_pending_registry_row';

const REGISTRY_PENDING_ID_COOKIE = 'nexops_pending_registry_id';
const COOKIE_MAX_AGE_SEC = 30 * 60;

function isNexopsCashProductionHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'nexops.cash' || h.endsWith('.nexops.cash');
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function clearPendingRegistryIdCookie(): void {
  if (typeof document === 'undefined') return;
  if (!isNexopsCashProductionHost()) return;
  document.cookie = `${REGISTRY_PENDING_ID_COOKIE}=; domain=.nexops.cash; path=/; max-age=0; Secure; SameSite=Lax`;
}

/** Queue opening a registry listing after GitHub OAuth (same-origin or hub → app). */
export function stashPendingRegistryContract(row: unknown): void {
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;

  try {
    sessionStorage.setItem(REGISTRY_PENDING_SESSION_KEY, JSON.stringify(row));
  } catch {
    /* quota — id cookie still helps on prod */
  }

  if (id && isNexopsCashProductionHost()) {
    document.cookie = `${REGISTRY_PENDING_ID_COOKIE}=${encodeURIComponent(id)}; domain=.nexops.cash; path=/; max-age=${COOKIE_MAX_AGE_SEC}; Secure; SameSite=Lax`;
  }
}

async function fetchRegistryContractById(id: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('contracts_registry')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * One-shot: clears stash/cookie so replays cannot duplicate workspaces.
 * Prefer session row; otherwise resolve via cookie id (hub OAuth → app).
 */
export async function consumePendingRegistryContract(): Promise<unknown | null> {
  try {
    const raw = sessionStorage.getItem(REGISTRY_PENDING_SESSION_KEY);
    if (raw) {
      sessionStorage.removeItem(REGISTRY_PENDING_SESSION_KEY);
      clearPendingRegistryIdCookie();
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
  } catch {
    /* ignore */
  }

  const id = readCookie(REGISTRY_PENDING_ID_COOKIE);
  if (!id) return null;
  clearPendingRegistryIdCookie();
  return fetchRegistryContractById(id);
}
