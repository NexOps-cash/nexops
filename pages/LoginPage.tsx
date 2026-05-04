import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/UI';
import {
  AUTH_RETURN_KEY,
  clearAuthRedirected,
  defaultAppUrl,
  isAllowedReturn,
  MAX_RETURN_URL_LENGTH,
  sanitizeReturnUrl,
  setOAuthPendingReturn,
} from '../lib/authRouting';

function resolveReturnCandidate(stored: string | null, queryReturn: string): string {
  let candidate: string;
  if (stored && queryReturn && stored !== queryReturn) {
    const queryOk =
      queryReturn.length > 0 &&
      queryReturn.length <= MAX_RETURN_URL_LENGTH &&
      isAllowedReturn(queryReturn);
    const storedOk =
      stored.length <= MAX_RETURN_URL_LENGTH && isAllowedReturn(stored);
    if (queryOk) candidate = queryReturn;
    else if (storedOk) candidate = stored;
    else candidate = defaultAppUrl();
  } else {
    candidate = stored || queryReturn || defaultAppUrl();
    if (candidate.length > MAX_RETURN_URL_LENGTH || !isAllowedReturn(candidate)) {
      candidate = defaultAppUrl();
    }
  }
  return sanitizeReturnUrl(candidate);
}

export const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const {
    user,
    isLoading,
    signInWithGithub,
    signInWithPassword,
    authEstablishError,
    clearAuthEstablishError,
    authError,
    retryInitialSession,
    authLoadingSlow,
  } = useAuth();

  const queryReturn = useMemo(() => searchParams.get('return') ?? '', [searchParams]);

  const [adminOpen, setAdminOpen] = useState(false);
  const defaultDemoEmail = import.meta.env.VITE_DEMO_LOGIN_EMAIL?.trim() ?? '';
  const [adminEmail, setAdminEmail] = useState(defaultDemoEmail);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminFormError, setAdminFormError] = useState<string | null>(null);

  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (!user && oauthError) {
      clearAuthRedirected();
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (isLoading || !user) return;

    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);

    const target = resolveReturnCandidate(stored, queryReturn);
    window.location.replace(target);
  }, [isLoading, user, queryReturn]);

  const prepareOAuthReturn = () => {
    const stored = sessionStorage.getItem(AUTH_RETURN_KEY);
    sessionStorage.removeItem(AUTH_RETURN_KEY);
    return resolveReturnCandidate(stored, queryReturn);
  };

  const handleGithub = async () => {
    clearAuthEstablishError();
    setAdminFormError(null);
    setOAuthPendingReturn(prepareOAuthReturn());
    await signInWithGithub();
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthEstablishError();
    setAdminFormError(null);
    setAdminBusy(true);
    try {
      const { error } = await signInWithPassword(adminEmail, adminPassword);
      if (error) {
        setAdminFormError(error);
        return;
      }
      setAdminPassword('');
    } finally {
      setAdminBusy(false);
    }
  };

  if (isLoading || user) {
    return (
      <div className="h-full min-h-[50vh] w-full flex items-center justify-center bg-nexus-900">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-[50vh] w-full flex items-center justify-center bg-nexus-900 text-white px-4">
      <div className="text-center space-y-6 max-w-sm w-full p-10 bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur">
        <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 border border-nexus-cyan/20 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-nexus-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Sign in</h1>
          <p className="text-white/40 text-sm leading-relaxed">Continue to access your NexOps workspace.</p>
        </div>

        {(authEstablishError || authError) && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200 space-y-2">
            {authEstablishError && <p>{authEstablishError}</p>}
            {authError && <p>{authError}</p>}
            <button
              type="button"
              onClick={() => {
                clearAuthEstablishError();
                void retryInitialSession();
              }}
              className="text-xs font-bold uppercase tracking-wider text-nexus-cyan hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {authLoadingSlow && !(authEstablishError || authError) && (
          <p className="text-white/30 text-xs">Still connecting…</p>
        )}

        <button
          type="button"
          onClick={() => void handleGithub()}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold rounded-2xl hover:bg-white/90 transition-all transform hover:-translate-y-0.5 shadow-lg"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          Continue with GitHub
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[#0f172a]/90 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">or</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden text-left">
          <button
            type="button"
            onClick={() => {
              setAdminOpen((o) => !o);
              setAdminFormError(null);
            }}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.04] transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-white/90">
              <Shield className="w-4 h-4 text-amber-400/90 shrink-0" aria-hidden />
              Demo / admin sign-in
            </span>
            <ChevronDown
              className={`w-4 h-4 text-white/40 shrink-0 transition-transform ${adminOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {adminOpen && (
            <form onSubmit={(e) => void handleAdminSubmit(e)} className="px-4 pb-4 pt-0 space-y-3 border-t border-white/5">
              <p className="text-[11px] text-white/35 leading-relaxed pt-3">
                Uses email + password from your Supabase Auth user (enable Email provider in the dashboard).
              </p>
              {adminFormError && (
                <p className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{adminFormError}</p>
              )}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-white/50 uppercase tracking-wider">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="demo@nexops.cash"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-nexus-cyan/40"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-white/50 uppercase tracking-wider">Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-nexus-cyan/40"
                />
              </div>
              <button
                type="submit"
                disabled={adminBusy || !adminEmail.trim() || !adminPassword}
                className="w-full py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-100 text-xs font-black uppercase tracking-widest disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                {adminBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <p className="text-white/20 text-xs">Your workspace data stays private and encrypted.</p>
      </div>
    </div>
  );
};
