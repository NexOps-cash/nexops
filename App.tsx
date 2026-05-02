import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { Project, ChainType } from './types';
import { TopMenuBar } from './components/TopMenuBar';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';
import { persistAuthReturnIfAbsent, resetHasHandledAuthBeforeLoginRedirect } from './lib/authRouting';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
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

// Helper component to enforce authentication (redirects to route-driven /login)
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || user) return;
    persistAuthReturnIfAbsent(window.location.href);
    resetHasHandledAuthBeforeLoginRedirect();
    navigate(`/login?return=${encodeURIComponent(window.location.href)}`, { replace: true });
  }, [isLoading, user, navigate]);

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-nexus-900">
        <div className="animate-spin w-8 h-8 border-2 border-nexus-cyan border-t-transparent rounded-full" />
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
  const { user } = useAuth();
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
          <Route path="/login" element={<LoginPage />} />
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
