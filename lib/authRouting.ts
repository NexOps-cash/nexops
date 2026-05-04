/** Central auth routing helpers — open-redirect safe return URLs, workspace redirect guard. */

export const AUTH_RETURN_KEY = 'auth_return';
export const AUTH_REDIRECTED_KEY = 'auth_redirected';
/** Written immediately before OAuth redirect; consumed after session resumes. */
export const OAUTH_PENDING_RETURN_KEY = 'oauth_pending_return';

export const MAX_RETURN_URL_LENGTH = 2000;

/** App production origin for OAuth redirectTo when not on localhost. */
export const APP_AUTH_ORIGIN = 'https://app.nexops.cash';

export function oauthRedirectBase(): string {
  if (typeof window === 'undefined') return APP_AUTH_ORIGIN;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return window.location.origin;
  return APP_AUTH_ORIGIN;
}

export function defaultAppUrl(): string {
  if (typeof window === 'undefined') return APP_AUTH_ORIGIN + '/';
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return window.location.origin + '/';
  return APP_AUTH_ORIGIN + '/';
}

/**
 * Post-login/OAuth return target when redirecting to `/login`.
 * Never points at `/login` itself (avoids nested `return=` loops in the query string).
 */
export function loginSafeReturnHref(): string {
  if (typeof window === 'undefined') return `${APP_AUTH_ORIGIN}/`;
  try {
    const { origin, pathname, search, hash } = window.location;
    if (pathname.startsWith('/login')) return `${origin}/`;
    return `${origin}${pathname}${search}${hash}`;
  } catch {
    return `${APP_AUTH_ORIGIN}/`;
  }
}

export function isWorkspacePath(pathname: string): boolean {
  return /^\/workspace\/[^/]+\/?$/.test(pathname);
}

export function isAllowedReturn(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1';
    if (u.protocol === 'javascript:' || u.protocol === 'data:') return false;
    if (!isLocal && u.protocol !== 'https:') return false;
    if (isLocal && u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return h === 'nexops.cash' || h.endsWith('.nexops.cash') || isLocal;
  } catch {
    return false;
  }
}

/**
 * Resolve return URLs relative to the current origin, validate host/protocol,
 * and preserve hash (wizard `#nxw=`). Returns a single absolute `href` so callers
 * never concatenate another origin in front.
 */
export function sanitizeReturnUrl(raw: string): string {
  const fallback = defaultAppUrl();
  if (!raw || raw.length > MAX_RETURN_URL_LENGTH) return fallback;
  let trimmed = raw.trim();

  // Hash-only wizard payload would otherwise resolve to origin "/" + hash only
  if (trimmed.startsWith('#') && trimmed.includes('nxw=')) {
    trimmed = '/wizard' + trimmed;
  }

  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : APP_AUTH_ORIGIN;
    const u = new URL(trimmed, base);
    if (u.protocol === 'javascript:' || u.protocol === 'data:') return fallback;
    const href = u.href;
    if (href.length > MAX_RETURN_URL_LENGTH) return fallback;
    if (!isAllowedReturn(href)) return fallback;
    try {
      const pathOnly = new URL(href);
      if (pathOnly.pathname.startsWith('/login')) return fallback;
    } catch {
      return fallback;
    }
    return href;
  } catch {
    return fallback;
  }
}

export interface AuthRedirectedPayload {
  ts: number;
  pathKey: string;
}

export function shouldRedirectToLogin(currentPathKey: string): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  const raw = sessionStorage.getItem(AUTH_REDIRECTED_KEY);
  if (!raw) return true;
  try {
    const d = JSON.parse(raw) as AuthRedirectedPayload;
    if (!d?.ts || Date.now() - d.ts > 3_000) return true;
    if (!d.pathKey || d.pathKey !== currentPathKey) return true;
    return false;
  } catch {
    return true;
  }
}

export function setAuthRedirected(pathKey: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const payload: AuthRedirectedPayload = { ts: Date.now(), pathKey };
  sessionStorage.setItem(AUTH_REDIRECTED_KEY, JSON.stringify(payload));
}

export function clearAuthRedirected(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(AUTH_REDIRECTED_KEY);
}

/** Call once from App root on mount — clears stale guard from previous tab/session. */
export function clearAuthRedirectedOnAppLoad(): void {
  clearAuthRedirected();
}

export function normalizeUrlForCompare(url: string): string {
  try {
    const base =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : APP_AUTH_ORIGIN;
    const u = new URL(url, base);
    const queryKeys = [...u.searchParams.keys()].sort().join(',');
    const hashPart = u.hash.includes('nxw=') ? u.hash : '';
    return (
      u.origin +
      u.pathname.replace(/\/$/, '') +
      (queryKeys ? `?keys=${queryKeys}` : '') +
      hashPart
    );
  } catch {
    return url;
  }
}

/** Persist validated post-login target — never stores `/login` URLs. */
export function persistAuthReturnIfAbsent(href?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  if (!sessionStorage.getItem(AUTH_RETURN_KEY)) {
    const raw =
      href ??
      (typeof window !== 'undefined' ? window.location.href : defaultAppUrl());
    sessionStorage.setItem(AUTH_RETURN_KEY, sanitizeReturnUrl(raw));
  }
}

/** Prevents duplicate window.location.replace + double onAuthStateChange vs getSession. */
let oauthResumeHandled = false;

export function resetOAuthResumeHandled(): void {
  oauthResumeHandled = false;
}

export function hasOAuthResumeAlreadyHandled(): boolean {
  return oauthResumeHandled;
}

export function markOAuthResumeHandled(): void {
  oauthResumeHandled = true;
}

/** Reset before navigating to /login so the next OAuth completion runs resume once. */
export function resetHasHandledAuthBeforeLoginRedirect(): void {
  resetOAuthResumeHandled();
}

export const WIZARD_PENDING_ACTION_KEY = 'wizard_pending_action';

/** Drop stale queued actions if the user returns long after redirect-to-login (OAuth-safe window). */
export const WIZARD_PENDING_ACTION_MAX_AGE_MS = 30 * 60 * 1000;

export type WizardPendingAction = 'download' | 'open_workspace';

interface WizardPendingPayload {
  action: WizardPendingAction;
  ts: number;
}

export function setWizardPendingAction(action: WizardPendingAction): void {
  if (typeof sessionStorage === 'undefined') return;
  const payload: WizardPendingPayload = { action, ts: Date.now() };
  sessionStorage.setItem(WIZARD_PENDING_ACTION_KEY, JSON.stringify(payload));
}

/**
 * One-time read: removes the key immediately so re-renders cannot replay download/workspace.
 * Returns a validated action string, or null if missing / expired / malformed.
 */
export function consumeWizardPendingAction(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(WIZARD_PENDING_ACTION_KEY);
  sessionStorage.removeItem(WIZARD_PENDING_ACTION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WizardPendingPayload>;
    const act = parsed.action;
    const ts = parsed.ts;
    if (act !== 'download' && act !== 'open_workspace') return null;
    if (typeof ts !== 'number' || Number.isNaN(ts)) return null;
    if (Date.now() - ts > WIZARD_PENDING_ACTION_MAX_AGE_MS) return null;
    return act;
  } catch {
    // Legacy plain string (pre-TTL); accept without age check.
    if (raw === 'download' || raw === 'open_workspace') return raw;
    return null;
  }
}

export function setOAuthPendingReturn(url: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const safe = sanitizeReturnUrl(url);
  sessionStorage.setItem(OAUTH_PENDING_RETURN_KEY, safe);
}

/** Local dev only: skip RequireAuth / DB workspace sync when no Supabase session (uses in-memory projects fallback). */
export function isDevAuthBypassEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = import.meta.env?.VITE_DEV_AUTH_BYPASS;
    if (v !== 'true' && v !== '1') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * Loopback dev server only (`localhost` / `127.0.0.1`). Production deployments never match.
 * Used to skip Supabase project load/sync — localStorage (`nexops_protocol_v2`) is the source of truth.
 */
export function isLocalhostRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch {
    return false;
  }
}
