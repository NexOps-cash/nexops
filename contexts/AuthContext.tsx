import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  AUTH_RETURN_KEY,
  clearAuthRedirected,
  hasOAuthResumeAlreadyHandled,
  markOAuthResumeHandled,
  OAUTH_PENDING_RETURN_KEY,
  oauthRedirectBase,
  resetOAuthResumeHandled,
  sanitizeReturnUrl,
} from '../lib/authRouting';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  authLoadingSlow: boolean;
  authEstablishError: string | null;
  signInWithGithub: () => Promise<void>;
  /** Supabase email + password (configure demo user in Dashboard → Authentication). */
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearAuthEstablishError: () => void;
  retryInitialSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_CHECK_SLOW_MS = 5000;

async function waitForSessionAfterOAuth(): Promise<void> {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    await new Promise((r) => setTimeout(r, 90));
  }
  await new Promise((r) => setTimeout(r, 1000));
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new Error('Session could not be established. Please retry login.');
  }
}

/** After OAuth: oauth_pending_return (explicit) beats auth_return (RequireAuth fallback). */
function tryResumeOAuthRedirect(): void {
  if (typeof window === 'undefined') return;
  if (hasOAuthResumeAlreadyHandled()) return;

  const pendingRaw = sessionStorage.getItem(OAUTH_PENDING_RETURN_KEY);
  const authReturnRaw = sessionStorage.getItem(AUTH_RETURN_KEY);

  let raw: string | null = null;
  if (pendingRaw) {
    raw = pendingRaw;
    sessionStorage.removeItem(OAUTH_PENDING_RETURN_KEY);
  } else if (authReturnRaw) {
    raw = authReturnRaw;
    sessionStorage.removeItem(AUTH_RETURN_KEY);
  }

  if (!raw) return;

  markOAuthResumeHandled();
  const url = sanitizeReturnUrl(raw);
  clearAuthRedirected();
  window.location.replace(url);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoadingSlow, setAuthLoadingSlow] = useState(false);
  const [authEstablishError, setAuthEstablishError] = useState<string | null>(null);
  const manualLogoutRef = useRef(false);
  /** Browser timer id (`window.setTimeout`); avoid `ReturnType<typeof setTimeout>` when `types` includes `node` (NodeJS.Timeout vs number). */
  const storageDebounceRef = useRef<number | null>(null);

  const clearAuthEstablishError = useCallback(() => setAuthEstablishError(null), []);

  const applySession = useCallback((sess: Session | null) => {
    setSession(sess);
    setUser(sess?.user ?? null);
    setIsLoading(false);
  }, []);

  const retryInitialSession = useCallback(async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      applySession(data.session);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Authentication failed. Retry.');
      setIsLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setAuthLoadingSlow(true);
    }, SESSION_CHECK_SLOW_MS);

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        setAuthLoadingSlow(false);
        if (error) {
          setAuthError(error.message);
          setIsLoading(false);
          return;
        }
        applySession(data.session);
      })
      .catch((e) => {
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        setAuthLoadingSlow(false);
        setAuthError(e instanceof Error ? e.message : 'Authentication failed.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [applySession]);

  useEffect(() => {
    if (!isLoading) setAuthLoadingSlow(false);
  }, [isLoading]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.includes('auth')) return;
      if (storageDebounceRef.current) window.clearTimeout(storageDebounceRef.current);
      storageDebounceRef.current = window.setTimeout(() => {
        storageDebounceRef.current = null;
        supabase.auth.getSession().then(({ data }) => {
          applySession(data.session);
        });
      }, 100);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [applySession]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (event === 'SIGNED_OUT' && !manualLogoutRef.current) {
        clearAuthRedirected();
      }
      if (event === 'SIGNED_OUT') {
        manualLogoutRef.current = false;
        resetOAuthResumeHandled();
      }

      applySession(sess);

      const pending = sessionStorage.getItem(OAUTH_PENDING_RETURN_KEY);
      const authRet = sessionStorage.getItem(AUTH_RETURN_KEY);
      const shouldTryResume =
        !!sess &&
        (!!pending || !!authRet) &&
        !hasOAuthResumeAlreadyHandled() &&
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION');

      if (shouldTryResume) {
        try {
          await waitForSessionAfterOAuth();
          tryResumeOAuthRedirect();
        } catch (err) {
          setAuthEstablishError(
            err instanceof Error ? err.message : 'Session could not be established.'
          );
          sessionStorage.removeItem(OAUTH_PENDING_RETURN_KEY);
          sessionStorage.removeItem(AUTH_RETURN_KEY);
          resetOAuthResumeHandled();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signInWithGithub = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: oauthRedirectBase(),
          skipBrowserRedirect: false,
        },
      });
    } catch (error) {
      console.error('Error signing in with GitHub:', error);
    }
  };

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      clearAuthEstablishError();
      setAuthError(null);
      const trimmed = email.trim();
      if (!trimmed || !password) {
        return { error: 'Enter email and password.' };
      }
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (error) return { error: error.message };
        return { error: null };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Sign in failed.' };
      }
    },
    [clearAuthEstablishError]
  );

  const signOut = async () => {
    manualLogoutRef.current = true;
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('nexops_protocol_v2');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        authError,
        authLoadingSlow,
        authEstablishError,
        signInWithGithub,
        signInWithPassword,
        signOut,
        clearAuthEstablishError,
        retryInitialSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
