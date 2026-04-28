import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { Project, ChainType } from './types';
import { TopMenuBar } from './components/TopMenuBar';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { CreateProject } from './pages/CreateProject';
import { RegistryPage } from './pages/RegistryPage';
import { WizardPage } from './pages/WizardPage';
import { Documentation } from './pages/Documentation';
import { PublishModal } from './components/PublishModal';
import { TopNav } from './components/TopNav';
import { Toaster, toast } from 'react-hot-toast';
import { SettingsModal } from './components/SettingsModal';
import { BYOKSettings } from './types';

const STORAGE_KEY = 'nexops_protocol_v2';
const BYOK_STORAGE_KEY = 'nexops_byok_settings';

// Helper component to enforce authentication
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, signInWithGithub, signInWithGoogle } = useAuth();

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white">
        <div className="text-center space-y-6 max-w-sm p-10 bg-white/5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur">
          {/* Lock icon */}
          <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 border border-nexus-cyan/20 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-nexus-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight">Authentication Required</h2>
            <p className="text-white/40 text-sm leading-relaxed">Sign in to access this area of the NexOps protocol.</p>
          </div>
          {/* GitHub button */}
          <button
            onClick={signInWithGithub}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-bold rounded-2xl hover:bg-white/90 transition-all transform hover:-translate-y-0.5 shadow-lg"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Continue with GitHub
          </button>
          {/* Google button hidden temporarily */}
          {/* <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button> */}
          <p className="text-white/20 text-xs">Your workspace data stays private and encrypted.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Helper component to sync URL params and verify ownership
const WorkspaceSync: React.FC<{
  setActiveProjectId: (id: string | null) => void;
  projects: Project[];
  projectsLoaded: boolean;
  userId?: string;
  onHydrateProject: (project: Project) => void;
  children: React.ReactNode;
}> = ({ setActiveProjectId, projects, projectsLoaded, userId, onHydrateProject, children }) => {
  const { projectId } = useParams();
  const [accessState, setAccessState] = useState<'checking' | 'granted' | 'denied'>('checking');

  const currentProject = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  useEffect(() => {
    let cancelled = false;
    async function verifyOwnership() {
      if (!projectId || !projectsLoaded || !userId) return;
      if (currentProject) {
        if (!cancelled) setAccessState('granted');
        return;
      }
      if (!cancelled) setAccessState('checking');
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setAccessState('denied');
          return;
        }
        const hydrated: Project = {
          id: data.id,
          name: data.name,
          chain: data.chain,
          contractCode: data.contract_code,
          files: data.files || [],
          versions: data.versions || [],
          auditReport: data.audit_report,
          deployedAddress: data.deployed_address,
          lastModified: typeof data.last_modified === 'string'
            ? new Date(data.last_modified).getTime()
            : data.last_modified
        };
        onHydrateProject(hydrated);
        setAccessState('granted');
      } catch {
        if (!cancelled) setAccessState('denied');
      }
    }
    verifyOwnership();
    return () => {
      cancelled = true;
    };
  }, [projectId, projectsLoaded, userId, currentProject, onHydrateProject]);

  // While projects are still loading from Supabase, show a spinner instead of
  // a false 'Project Not Found' error.
  if (!projectsLoaded || accessState === 'checking') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white font-mono">
        <div className="text-center space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full mx-auto" />
          <p className="opacity-50 text-sm">Checking workspace access...</p>
        </div>
      </div>
    );
  }

  // If denied after ownership check, explicitly report no access.
  if (!currentProject || accessState === 'denied') {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white font-mono">
        <div className="text-center space-y-4 max-w-md p-8 bg-white/5 rounded-3xl border border-white/10">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          </div>
          <h2 className="text-xl font-black italic">No Access</h2>
          <p className="opacity-50 text-sm">You do not have permission to open this workspace.</p>
          <button onClick={() => window.location.href = '/'} className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-xs hover:bg-white/10 transition-all">Return Home</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Persistence state
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse local storage", e);
      return [];
    }
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const { user, isLoading: isAuthLoading, signInWithGithub } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  // Track whether we've finished loading projects from Supabase.
  // If the user isn't logged in, we only use localStorage so it's instantly loaded.
  const [projectsLoaded, setProjectsLoaded] = useState(!user);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPublishingReg, setIsPublishingReg] = useState(false);

  // BYOK Settings
  const [byokSettings, setByokSettings] = useState<BYOKSettings>(() => {
    const saved = localStorage.getItem(BYOK_STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : { apiKey: '', provider: 'groq' };
    } catch (e) {
      return { apiKey: '', provider: 'groq' };
    }
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Subdomain Detection
  const getPersona = () => {
    const hostname = window.location.hostname;
    if (hostname.includes('docs.nexops.cash')) return 'docs';
    if (hostname.includes('wiz.nexops.cash')) return 'wizard';
    if (hostname.includes('hub.nexops.cash')) return 'registry';
    return 'app'; // Central hub (app.nexops.cash or localhost)
  };
  const persona = getPersona();

  // Reset projectsLoaded whenever user changes (e.g. logout → login)
  useEffect(() => {
    setProjectsLoaded(!user);
  }, [!!user]);

  // Project loading from Supabase when user logs in
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (backendUrl) {
      fetch(`${backendUrl}/health`).catch(() => { });
    }

    async function loadProjects() {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('last_modified', { ascending: false });

        if (error) throw error;
        if (data && data.length > 0) {
          const mappedProjects: Project[] = data.map(row => ({
            id: row.id,
            name: row.name,
            chain: row.chain,
            contractCode: row.contract_code,
            files: row.files || [],
            versions: row.versions || [],
            auditReport: row.audit_report,
            deployedAddress: row.deployed_address,
            lastModified: typeof row.last_modified === 'string' ? new Date(row.last_modified).getTime() : row.last_modified
          }));
          setProjects(prev => {
            const localMap = new Map(prev.map(p => [p.id, p]));
            mappedProjects.forEach(remote => {
              const local = localMap.get(remote.id);
              if (!local || remote.lastModified > local.lastModified) localMap.set(remote.id, remote);
            });
            return Array.from(localMap.values()).sort((a, b) => b.lastModified - a.lastModified);
          });
        }
      } catch (err) { } finally {
        // Mark projects as loaded so WorkspaceSync stops showing the loading spinner
        setProjectsLoaded(true);
      }
    }
    loadProjects();
  }, [user]);

  // Sync projects to Supabase
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    async function syncToSupabase() {
      if (!user || projects.length === 0 || isSyncing) return;
      const p = projects.find(row => row.id === activeProjectId);
      if (!p || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id)) return;

      setIsSyncing(true);
      try {
        await supabase.from('projects').upsert({
          id: p.id, user_id: user.id, name: p.name, chain: p.chain,
          contract_code: p.contractCode, files: p.files, versions: p.versions,
          audit_report: p.auditReport, deployed_address: p.deployedAddress, last_modified: Date.now()
        });
      } catch (err) { console.error("Sync error", err); } finally { setIsSyncing(false); }
    }
    const timeout = setTimeout(syncToSupabase, 1500);
    return () => clearTimeout(timeout);
  }, [projects, user, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const handleHydrateProject = React.useCallback((project: Project) => {
    setProjects((prev) => {
      const without = prev.filter((p) => p.id !== project.id);
      return [project, ...without];
    });
  }, []);

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => {
      const index = prev.findIndex(p => p.id === updatedProject.id);
      if (index === -1) return [updatedProject, ...prev];
      const newProjects = [...prev];
      newProjects[index] = { ...updatedProject, lastModified: Date.now() };
      return newProjects;
    });
  };

  const handleSelectProject = (projectId: string) => {
    try {
      localStorage.setItem('nexops_last_project_id', projectId);
    } catch {
      /* ignore quota / private mode */
    }
    setActiveProjectId(projectId);
    if (persona === 'app') navigate(`/workspace/${projectId}`);
    else window.location.href = `https://app.nexops.cash/workspace/${projectId}`;
  };

  const handleCreateProject = async (project: Project) => {
    try {
      localStorage.setItem('nexops_last_project_id', project.id);
    } catch {
      /* ignore */
    }
    setProjects(prev => [project, ...prev.filter(p => p.id !== project.id)]);
    setActiveProjectId(project.id);

    // Ownership-based cross-subdomain flow:
    // persist first under current auth user, then redirect by project id only.
    if (persona !== 'app') {
      if (!user) {
        toast.error('Please sign in before creating a workspace.');
        return;
      }
      try {
        const { error } = await supabase.from('projects').upsert({
          id: project.id,
          user_id: user.id,
          name: project.name,
          chain: project.chain,
          contract_code: project.contractCode,
          files: project.files,
          versions: project.versions,
          audit_report: project.auditReport,
          deployed_address: project.deployedAddress,
          last_modified: Date.now()
        });
        if (error) throw error;
        window.location.href = `https://app.nexops.cash/workspace/${project.id}`;
        return;
      } catch (e: any) {
        console.error('Failed to create cross-subdomain workspace record', e);
        toast.error(`Could not create workspace: ${e?.message || 'server error'}`);
        return;
      }
    }

    if (persona === 'app') {
      navigate(`/workspace/${project.id}`);
    }
  };

  const handleNavigate = (view: string) => {
    const subdomainMap: Record<string, string> = {
      docs: 'docs',
      wizard: 'wiz',
      registry: 'hub',
      workspace: 'app',
      home: 'app'
    };

    const targetSub = subdomainMap[view];
    const currentSub = subdomainMap[persona] || (window.location.hostname.includes('localhost') ? null : 'app');

    // If crossing subdomains, use hard jump with clean URL awareness
    if (targetSub && targetSub !== currentSub && !window.location.hostname.includes('localhost')) {
      if (view === 'workspace') {
        window.location.href = 'https://app.nexops.cash/';
        return;
      }
      window.location.href = `https://${targetSub}.nexops.cash/${view}`;
      return;
    }

    // Internal navigation — Workspace = home hub (recent projects, Core IDE cards)
    if (view === 'workspace') {
      navigate('/');
    } else if (view === 'home') {
      navigate('/');
    } else {
      navigate(`/${view}`);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-nexus-900">
      {!location.pathname.startsWith('/workspace') && (
        <TopNav
          isSyncing={isSyncing}
          syncError={syncError}
          activeView={
            location.pathname === '/' || location.pathname === ''
              ? 'workspace'
              : location.pathname.split('/')[1] || persona
          }
          onNavigate={handleNavigate}
        />
      )}

      {location.pathname.startsWith('/workspace') && activeProject && (
        <TopMenuBar
          isSyncing={isSyncing} activeProject={activeProject}
          onAction={(a) => {
            if (a === 'New Project') { setActiveProjectId(null); navigate('/creator'); }
            else if (a === 'Settings') setIsSettingsModalOpen(true);
            else if (a === 'Documentation') window.open('https://docs.nexops.cash', '_blank');
          }}
        />
      )}

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        <Routes>
          <Route path="/" element={
            persona === 'docs' ? <Documentation /> :
              persona === 'wizard' ? <RequireAuth><WizardPage onNavigateHome={() => handleNavigate('home')} onCreateProject={handleCreateProject} /></RequireAuth> :
                persona === 'registry' ? <RegistryPage onLoadContract={(c: any) => handleCreateProject({ ...c, id: crypto.randomUUID() })} /> :
                  <LandingPage projects={projects} onSelectProject={handleSelectProject} onNavigateCreator={() => navigate('/creator')} onNavigateWizard={() => handleNavigate('wizard')} onNavigateRegistry={() => handleNavigate('registry')} />
          } />

          <Route path="/workspace/:projectId" element={
            <RequireAuth>
              <WorkspaceSync
                setActiveProjectId={setActiveProjectId}
                projects={projects}
                projectsLoaded={projectsLoaded}
                userId={user?.id}
                onHydrateProject={handleHydrateProject}
              >
                {activeProject ? (
                  <ProjectWorkspace project={activeProject} onUpdateProject={handleUpdateProject} walletConnected={walletConnected} onConnectWallet={() => setWalletConnected(!walletConnected)} onNavigateHome={() => handleNavigate('home')} onPublish={() => setIsPublishModalOpen(true)} byokSettings={byokSettings} />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-nexus-900 text-white font-mono">
                    <div className="text-center space-y-4">
                      <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full mx-auto" />
                      <p className="opacity-50">Synchronizing Workspace...</p>
                    </div>
                  </div>
                )}
              </WorkspaceSync>
            </RequireAuth>
          } />
          <Route path="/creator" element={<RequireAuth><div className="h-full w-full bg-nexus-900 overflow-auto"><CreateProject onNavigate={() => handleNavigate('home')} onCreateProject={handleCreateProject} /></div></RequireAuth>} />
          <Route path="/wizard" element={<RequireAuth><WizardPage onNavigateHome={() => handleNavigate('home')} onCreateProject={handleCreateProject} /></RequireAuth>} />
          <Route path="/registry" element={<RegistryPage onLoadContract={(c: any) => handleCreateProject({ ...c, id: crypto.randomUUID() })} />} />
          <Route path="/docs" element={<Documentation />} />
          <Route path="/docs/:sectionId" element={<Documentation />} />
        </Routes>
      </div>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={byokSettings} onSave={setByokSettings} />
      <Toaster position="bottom-right" />
    </div>
  );
};

export default App;
