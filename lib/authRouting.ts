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

export function sanitizeReturnUrl(raw: string): string {
  const fallback = defaultAppUrl();
  if (!raw || raw.length > MAX_RETURN_URL_LENGTH) return fallback;
  const trimmed = raw.trim();
  if (!isAllowedReturn(trimmed)) return fallback;
  return trimmed;
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
    const u = new URL(url);
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

/** Persist full href (incl. hash) before navigating to login — only if absent. */
export function persistAuthReturnIfAbsent(): void {
  if (typeof sessionStorage === 'undefined') return;
  if (!sessionStorage.getItem(AUTH_RETURN_KEY)) {
    sessionStorage.setItem(AUTH_RETURN_KEY, window.location.href);
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
