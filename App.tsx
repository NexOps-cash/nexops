import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { Project } from './types';
import { TopMenuBar } from './components/TopMenuBar';
import { useAuth } from './contexts/AuthContext';
import {
  clearAuthRedirectedOnAppLoad,
  isDevAuthBypassEnabled,
  isLocalhostRuntime,
  isWorkspacePath,
  loginSafeReturnHref,
  persistAuthReturnIfAbsent,
  resetHasHandledAuthBeforeLoginRedirect,
  setAuthRedirected,
  shouldRedirectToLogin,
} from './lib/authRouting';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { CreateProject } from './pages/CreateProject';
import { RegistryPage } from './pages/RegistryPage';
import { WizardPage } from './pages/WizardPage';
import { Documentation } from './pages/Documentation';
import { TopNav } from './components/TopNav';
import { Toaster, toast } from 'react-hot-toast';
import { SettingsModal } from './components/SettingsModal';
import { BYOKSettings } from './types';
import { loadProjectByIdForUser, loadProjectsForUser, upsertProjectRow } from './services/projectQueries';
import { registryRowToProject } from './lib/registryContract';
import { consumePendingRegistryContract } from './lib/pendingRegistryLoad';
import { ensureContractCodeAsCashFile } from './lib/projectNormalize';

const STORAGE_KEY = 'nexops_protocol_v2';
const BYOK_STORAGE_KEY = 'nexops_byok_settings';

/** Avoid sending workspace URLs to /login while Supabase restores session (cold load / OAuth). */
const WORKSPACE_AUTH_GRACE_MS = 1500;

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  /** Loopback dev: open IDE/creator without GitHub (production uses real hostnames only). */
  const skipAuthGate = isLocalhostRuntime();
  const workspaceAuthGraceUntilRef = useRef(0);

  useEffect(() => {
    if (skipAuthGate) return;
    if (isWorkspacePath(location.pathname)) {
      workspaceAuthGraceUntilRef.current = Date.now() + WORKSPACE_AUTH_GRACE_MS;
    }
  }, [location.pathname, skipAuthGate]);

  useEffect(() => {
    if (skipAuthGate) return;
    if (isLoading || user) return;
    const pathKey = `${window.location.origin}${window.location.pathname}`;
    const ws = isWorkspacePath(location.pathname);
    if (ws && Date.now() < workspaceAuthGraceUntilRef.current) return;
    if (ws && !shouldRedirectToLogin(pathKey)) return;

    resetHasHandledAuthBeforeLoginRedirect();
    persistAuthReturnIfAbsent(loginSafeReturnHref());
    if (ws && shouldRedirectToLogin(pathKey)) {
      setAuthRedirected(pathKey);
    }
    navigate(`/login?return=${encodeURIComponent(loginSafeReturnHref())}`, { replace: true });
  }, [skipAuthGate, isLoading, user, navigate, location.pathname]);

  if (skipAuthGate) {
    return <>{children}</>;
  }

  if (isLoading) {
    const workspaceRoute = location.pathname.startsWith('/workspace');
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-nexus-900 text-white">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
        {workspaceRoute && <p className="opacity-50 text-sm font-mono">Checking access…</p>}
      </div>
    );
  }

  if (!user) {
    const pathKey = `${window.location.origin}${window.location.pathname}`;
    if (isWorkspacePath(location.pathname) && !shouldRedirectToLogin(pathKey)) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-nexus-900 text-white font-mono">
          <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
          <p className="opacity-50 text-sm">Completing login… please wait</p>
        </div>
      );
    }
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
};

const WorkspaceSync: React.FC<{
  setActiveProjectId: (id: string | null) => void;
  userId: string;
  onHydrateProject: (project: Project) => void;
  removeFromLocalCache: (projectId: string) => void;
  /** Parent `projects` list; on localhost-only mode used to hydrate workspace without hitting Supabase. */
  workspaceParentProjects: Project[];
  onUpdateProject: (project: Project) => void;
  children: (
    project: Project,
    updateWorkspaceProject: (project: Project) => void,
  ) => React.ReactNode;
}> = ({
  setActiveProjectId,
  userId,
  onHydrateProject,
  removeFromLocalCache,
  workspaceParentProjects,
  onUpdateProject,
  children,
}) => {
  const { projectId } = useParams();
  const { isLoading: authLoading } = useAuth();
  const [phase, setPhase] = useState<'loading' | 'denied' | 'granted'>('loading');
  /** Same render as `phase === 'granted'` — avoids a prod-only flicker where parent `projects.find(activeProjectId)` is briefly null. */
  const [grantedProject, setGrantedProject] = useState<Project | null>(null);
  const requestIdRef = useRef(0);
  /** Latest parent list without listing it as an effect dep — avoids reload loop after onHydrateProject updates `projects`. */
  const workspaceProjectsRef = useRef(workspaceParentProjects);
  workspaceProjectsRef.current = workspaceParentProjects;

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    setGrantedProject(null);
    setPhase('loading');
  }, [projectId]);

  const pushGranted = useCallback(
    (project: Project) => {
      const normalized = ensureContractCodeAsCashFile(project);
      setGrantedProject(normalized);
      onHydrateProject(normalized);
      setPhase('granted');
    },
    [onHydrateProject],
  );

  const updateWorkspaceProject = useCallback(
    (project: Project) => {
      const normalized = ensureContractCodeAsCashFile(project);
      setGrantedProject(normalized);
      onUpdateProject(normalized);
    },
    [onUpdateProject],
  );

  useEffect(() => {
    if (!projectId) {
      setGrantedProject(null);
      setPhase('denied');
      return;
    }

    // Local dev: never verify against DB — use in-memory + localStorage mirror only.
    if (isLocalhostRuntime()) {
      const local = workspaceProjectsRef.current.find((p) => p.id === projectId);
      if (local) {
        pushGranted(local);
        return;
      }
      removeFromLocalCache(projectId);
      setActiveProjectId(null);
      setGrantedProject(null);
      setPhase('denied');
      return;
    }

    if (authLoading) return;

    const bypass = isDevAuthBypassEnabled();
    if ((!userId || userId.trim() === '') && bypass) {
      const local = workspaceProjectsRef.current.find((p) => p.id === projectId);
      if (local) {
        pushGranted(local);
        return;
      }
      removeFromLocalCache(projectId);
      setActiveProjectId(null);
      setGrantedProject(null);
      setPhase('denied');
      return;
    }

    if (!userId || userId.trim() === '') {
      setGrantedProject(null);
      setPhase('denied');
      return;
    }

    const ac = new AbortController();
    const myId = ++requestIdRef.current;
    setGrantedProject(null);
    setPhase('loading');

    loadProjectByIdForUser(projectId, ac.signal).then(({ project, error }) => {
      if (myId !== requestIdRef.current) return;
      if (error || !project) {
        if (bypass) {
          const localFallback = workspaceProjectsRef.current.find((p) => p.id === projectId);
          if (localFallback) {
            pushGranted(localFallback);
            return;
          }
        }
        removeFromLocalCache(projectId);
        setActiveProjectId(null);
        setGrantedProject(null);
        setPhase('denied');
        return;
      }
      pushGranted(project);
    });

    return () => ac.abort();
  }, [projectId, authLoading, userId, pushGranted, removeFromLocalCache, setActiveProjectId]);

  if (!isLocalhostRuntime() && authLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-nexus-900 text-white font-mono gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
        <p className="opacity-50 text-sm">Checking access…</p>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-nexus-900 text-white font-mono gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
        <p className="opacity-50 text-sm">Loading workspace…</p>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white font-mono">
        <div className="text-center space-y-4 max-w-md p-8 bg-white/5 rounded-3xl border border-white/10">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </div>
          <h2 className="text-xl font-black italic">Project not found or access denied</h2>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-all"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!grantedProject) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white font-mono">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full mx-auto" />
          <p className="opacity-50">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children(grantedProject, updateWorkspaceProject)}</>;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    clearAuthRedirectedOnAppLoad();
  }, []);

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse local storage', e);
      return [];
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const {
    user,
    isLoading: authLoading,
    authError,
    authLoadingSlow,
    retryInitialSession,
  } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const [byokSettings, setByokSettings] = useState<BYOKSettings>(() => {
    const saved = localStorage.getItem(BYOK_STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : { apiKey: '', provider: 'groq' };
    } catch {
      return { apiKey: '', provider: 'groq' };
    }
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const getPersona = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('docs.nexops.cash')) return 'docs';
    if (hostname.includes('hub.nexops.cash')) return 'registry';
    return 'app';
  };
  const persona = getPersona();

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (backendUrl) {
      fetch(`${backendUrl}/health`).catch(() => {});
    }

    async function loadProjects() {
      if (!user || isLocalhostRuntime()) return;
      try {
        const mappedProjects = await loadProjectsForUser(user.id);
        if (mappedProjects.length > 0) {
          setProjects((prev) => {
            const localMap = new Map(prev.map((p) => [p.id, p]));
            mappedProjects.forEach((remote) => {
              const local = localMap.get(remote.id);
              if (!local || remote.lastModified > local.lastModified) localMap.set(remote.id, remote);
            });
            return Array.from(localMap.values()).sort((a, b) => b.lastModified - a.lastModified);
          });
        }
      } catch {
        /* ignore */
      }
    }
    loadProjects();
  }, [user]);

  /** Supabase project upsert — debounced while editing; Save triggers immediate enqueue via same path. */
  const SYNC_DEBOUNCE_MS = 10_000;
  const persistTailRef = useRef(Promise.resolve());

  const enqueuePersistRemote = useCallback((p: Project) => {
    persistTailRef.current = persistTailRef.current
      .then(async () => {
        if (!user || isLocalhostRuntime()) return;
        const normalized = ensureContractCodeAsCashFile(p);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized.id))
          return;

        setIsSyncing(true);
        try {
          const { error } = await upsertProjectRow(normalized, user.id);
          if (error) console.error('Sync error', error);
        } finally {
          setIsSyncing(false);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    const onWorkspace = location.pathname.startsWith('/workspace');
    if (!onWorkspace || !user || projects.length === 0) return;

    const p = projects.find((row) => row.id === activeProjectId);
    if (!p) return;

    const timeout = window.setTimeout(() => {
      enqueuePersistRemote(p);
    }, SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [projects, user, activeProjectId, location.pathname, enqueuePersistRemote]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  const handleHydrateProject = React.useCallback((project: Project) => {
    const normalized = ensureContractCodeAsCashFile(project);
    setProjects((prev) => {
      const without = prev.filter((p) => p.id !== normalized.id);
      return [normalized, ...without];
    });
  }, []);

  const removeFromLocalCache = useCallback((projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  }, []);

  const handleUpdateProject = useCallback((updatedProject: Project) => {
    const normalized = ensureContractCodeAsCashFile(updatedProject);
    setProjects((prev) => {
      const index = prev.findIndex((p) => p.id === normalized.id);
      if (index === -1) return [normalized, ...prev];
      const newProjects = [...prev];
      newProjects[index] = { ...normalized, lastModified: Date.now() };
      return newProjects;
    });
  }, []);

  const handleSelectProject = (projectId: string) => {
    try {
      localStorage.setItem('nexops_last_project_id', projectId);
    } catch {
      /* ignore */
    }
    setActiveProjectId(projectId);
    if (persona === 'app') navigate(`/workspace/${projectId}`);
    else window.location.href = `https://app.nexops.cash/workspace/${projectId}`;
  };

  const handleCreateProject = async (project: Project) => {
    const p = ensureContractCodeAsCashFile(project);
    try {
      localStorage.setItem('nexops_last_project_id', p.id);
    } catch {
      /* ignore */
    }
    setProjects((prev) => [p, ...prev.filter((row) => row.id !== p.id)]);
    setActiveProjectId(p.id);

    if (persona !== 'app') {
      if (!user) {
        toast.error('Please sign in before creating a workspace.');
        return;
      }
      try {
        const { error } = await upsertProjectRow(p, user.id);
        if (error) throw error;
        window.location.href = `https://app.nexops.cash/workspace/${p.id}`;
        return;
      } catch (e: unknown) {
        console.error('Failed to create cross-subdomain workspace record', e);
        toast.error(`Could not create workspace: ${e instanceof Error ? e.message : 'server error'}`);
        return;
      }
    }

    // Production / non-localhost: persist before navigate so WorkspaceSync can load by id from Supabase.
    if (!isLocalhostRuntime() && user) {
      try {
        const { error } = await upsertProjectRow(p, user.id);
        if (error) throw error;
      } catch (e: unknown) {
        console.error('Failed to persist new workspace', e);
        toast.error(`Could not create workspace: ${e instanceof Error ? e.message : 'server error'}`);
        setProjects((prev) => prev.filter((row) => row.id !== p.id));
        setActiveProjectId(null);
        return;
      }
    }

    navigate(`/workspace/${p.id}`);
  };

  const handleRegistryContractLoad = (row: unknown) => {
    const project = registryRowToProject(row);
    if (!project.contractCode.trim()) {
      toast.error('This listing has no source code to load.');
      return;
    }
    void handleCreateProject(project);
  };

  const handleRegistryContractLoadRef = useRef(handleRegistryContractLoad);
  handleRegistryContractLoadRef.current = handleRegistryContractLoad;

  useEffect(() => {
    if (!user || authLoading) return;
    const lockKey = `nexops_registry_resume_lock_${user.id}`;
    if (sessionStorage.getItem(lockKey)) return;
    sessionStorage.setItem(lockKey, '1');
    void (async () => {
      try {
        const row = await consumePendingRegistryContract();
        sessionStorage.removeItem(lockKey);
        if (!row) return;
        handleRegistryContractLoadRef.current(row);
      } catch {
        sessionStorage.removeItem(lockKey);
      }
    })();
  }, [user, authLoading]);

  const handleNavigate = (view: string) => {
    const subdomainMap: Record<string, string> = {
      docs: 'docs',
      wizard: 'app',
      registry: 'hub',
      workspace: 'app',
      home: 'app',
    };

    const targetSub = subdomainMap[view];
    const currentSub =
      subdomainMap[persona] || (window.location.hostname.includes('localhost') ? null : 'app');

    if (targetSub && targetSub !== currentSub && !window.location.hostname.includes('localhost')) {
      if (view === 'workspace') {
        window.location.href = 'https://app.nexops.cash/';
        return;
      }
      if (view === 'wizard') {
        window.location.href = 'https://app.nexops.cash/wizard';
        return;
      }
      window.location.href = `https://${targetSub === 'app' ? 'app' : targetSub}.nexops.cash/${view}`;
      return;
    }

    if (view === 'workspace' || view === 'home') {
      navigate('/');
    } else {
      navigate(`/${view}`);
    }
  };

  return (
    <div className="flex flex-1 flex-col min-h-0 h-full w-full overflow-hidden bg-nexus-900">
      {(authError || authLoadingSlow) && (
        <div className="shrink-0 px-4 py-2 bg-amber-900/40 border-b border-amber-700/50 text-amber-100 text-xs flex items-center justify-between gap-4">
          <span>
            {authError
              ? authError
              : 'Authentication check is taking too long. Please retry.'}
          </span>
          <button
            type="button"
            className="underline shrink-0"
            onClick={() => retryInitialSession()}
          >
            Retry
          </button>
        </div>
      )}

      {!location.pathname.startsWith('/workspace') && (
        <TopNav
          activeView={
            location.pathname === '/' || location.pathname === ''
              ? 'workspace'
              : location.pathname.split('/')[1] || persona
          }
          onNavigate={handleNavigate}
        />
      )}

      {location.pathname.startsWith('/workspace') && (
        <TopMenuBar
          isSyncing={isSyncing}
          activeProject={activeProject}
          onAction={(a) => {
            if (a === 'New Project') {
              setActiveProjectId(null);
              navigate('/creator');
            } else if (a === 'Settings') setIsSettingsModalOpen(true);
            else if (a === 'Documentation') window.open('https://docs.nexops.cash', '_blank');
            else if (a === 'Publish to Registry') {
              window.dispatchEvent(new CustomEvent('nexops-open-publish-registry'));
            }
          }}
        />
      )}

      <div
        className={
          location.pathname.startsWith('/workspace')
            ? 'flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col overscroll-none'
            : location.pathname.startsWith('/wizard')
              ? 'flex-1 min-h-0 min-w-0 overflow-hidden flex flex-col overscroll-none'
              : 'flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden'
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              persona === 'docs' ? (
                <Documentation />
              ) : persona === 'registry' ? (
                <RegistryPage onLoadContract={handleRegistryContractLoad} />
              ) : (
                <LandingPage
                  isLoggedIn={!!user}
                  projects={user ? projects : []}
                  onSelectProject={handleSelectProject}
                  onNavigateCreator={() => navigate('/creator')}
                  onNavigateWizard={() => handleNavigate('wizard')}
                  onNavigateRegistry={() => handleNavigate('registry')}
                  onRequestSignIn={() =>
                    navigate(`/login?return=${encodeURIComponent(window.location.origin + '/')}`)
                  }
                />
              )
            }
          />

          <Route
            path="/workspace/:projectId"
            element={
              <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden w-full">
                <RequireAuth>
                  <WorkspaceSync
                    setActiveProjectId={setActiveProjectId}
                    userId={user?.id ?? ''}
                    onHydrateProject={handleHydrateProject}
                    removeFromLocalCache={removeFromLocalCache}
                    workspaceParentProjects={projects}
                    onUpdateProject={handleUpdateProject}
                  >
                    {(workspaceProject, updateWorkspaceProject) => (
                      <ProjectWorkspace
                        project={workspaceProject}
                        onUpdateProject={updateWorkspaceProject}
                        onPersistToDb={(p) => void enqueuePersistRemote(p)}
                        walletConnected={walletConnected}
                        onConnectWallet={() => setWalletConnected(!walletConnected)}
                        onNavigateHome={() => handleNavigate('home')}
                        byokSettings={byokSettings}
                      />
                    )}
                  </WorkspaceSync>
                </RequireAuth>
              </div>
            }
          />
          <Route
            path="/creator"
            element={
              <RequireAuth>
                <div className="h-full w-full bg-nexus-900 overflow-auto">
                  <CreateProject
                    onNavigate={() => handleNavigate('home')}
                    onCreateProject={handleCreateProject}
                  />
                </div>
              </RequireAuth>
            }
          />
          <Route
            path="/wizard"
            element={
              <WizardPage onCreateProject={handleCreateProject} />
            }
          />
          <Route
            path="/registry"
            element={
              <RegistryPage onLoadContract={handleRegistryContractLoad} />
            }
          />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/docs/:sectionId" element={<Documentation />} />
        </Routes>
      </div>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={byokSettings}
        onSave={setByokSettings}
      />
      <Toaster position="bottom-right" />
    </div>
  );
};

export default App;
