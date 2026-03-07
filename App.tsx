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

// Helper component to sync URL params to App state
const WorkspaceSync: React.FC<{
  setActiveProjectId: (id: string | null) => void;
  children: React.ReactNode;
}> = ({ setActiveProjectId, children }) => {
  const { projectId } = useParams();
  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);
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
      } catch (err) { }
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
    setActiveProjectId(projectId);
    if (persona === 'app') navigate(`/workspace/${projectId}`);
    else window.location.href = `https://app.nexops.cash/#/workspace/${projectId}`;
  };

  const handleCreateProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
    if (persona === 'app') navigate(`/workspace/${project.id}`);
    else window.location.href = `https://app.nexops.cash/#/workspace/${project.id}`;
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

    // If crossing subdomains, use hard jump with HashRouter awareness
    if (targetSub && targetSub !== currentSub && !window.location.hostname.includes('localhost')) {
      window.location.href = `https://${targetSub}.nexops.cash/#/${view === 'workspace' && activeProjectId ? `workspace/${activeProjectId}` : ''}`;
      return;
    }

    // Internal navigation
    if (view === 'workspace') {
      if (activeProjectId) navigate(`/workspace/${activeProjectId}`);
      else navigate('/creator');
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
          activeView={location.pathname.startsWith('/workspace') ? 'workspace' : location.pathname.split('/')[1] || persona}
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

      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={
            persona === 'docs' ? <Documentation /> :
              persona === 'wizard' ? <WizardPage onNavigateHome={() => handleNavigate('home')} onCreateProject={handleCreateProject} /> :
                persona === 'registry' ? <RegistryPage onLoadContract={(c: any) => handleCreateProject({ ...c, id: crypto.randomUUID() })} /> :
                  <LandingPage projects={projects} onSelectProject={handleSelectProject} onNavigateCreator={() => navigate('/creator')} onNavigateWizard={() => handleNavigate('wizard')} onNavigateRegistry={() => handleNavigate('registry')} />
          } />

          <Route path="/workspace/:projectId" element={
            <WorkspaceSync setActiveProjectId={setActiveProjectId}>
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
          } />
          <Route path="/creator" element={<div className="h-full w-full bg-nexus-900 overflow-auto"><CreateProject onNavigate={() => handleNavigate('home')} onCreateProject={handleCreateProject} /></div>} />
          <Route path="/wizard" element={<WizardPage onNavigateHome={() => handleNavigate('home')} onCreateProject={handleCreateProject} />} />
          <Route path="/registry" element={<RegistryPage onLoadContract={(c: any) => handleCreateProject({ ...c, id: crypto.randomUUID() })} />} />
          <Route path="/docs" element={<Documentation />} />
        </Routes>
      </div>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={byokSettings} onSave={setByokSettings} />
      <Toaster position="bottom-right" />
    </div>
  );
};

export default App;
