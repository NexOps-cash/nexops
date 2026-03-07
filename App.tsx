import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
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

  // Subdomain Routing Logic
  useEffect(() => {
    const hostname = window.location.hostname;
    const path = window.location.pathname;

    // Only redirect if at root path to avoid infinite loops or blocking deep links
    if (path === '/') {
      if (hostname.includes('docs.nexops.cash')) navigate('/docs', { replace: true });
      else if (hostname.includes('wiz.nexops.cash')) navigate('/wizard', { replace: true });
      else if (hostname.includes('hub.nexops.cash')) navigate('/registry', { replace: true });
      else if (hostname.includes('app.nexops.cash')) navigate('/workspace', { replace: true });
    }
  }, [navigate]);

  // Load projects from Supabase when user logs in
  useEffect(() => {
    // Render.com MCP Wakeup Ping
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    if (backendUrl) {
      console.log('[Nexus OS] Sending wakeup ping to MCP backend...');
      fetch(`${backendUrl}/health`)
        .then(res => console.log('[Nexus OS] MCP Backend ready:', res.ok))
        .catch(err => console.warn('[Nexus OS] MCP Wakeup ping sent:', err.message));
    }

    async function loadProjects() {
      setSyncError(null);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const localProjects = JSON.parse(saved);
          if (localProjects.length > 0) setProjects(localProjects);
        } catch (e) {
          console.error("Local cache corrupt", e);
        }
      }

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
            const localMap = new Map<string, Project>(prev.map(p => [p.id, p]));
            let hasChanges = false;
            mappedProjects.forEach(remote => {
              const local = localMap.get(remote.id);
              if (!local || remote.lastModified > local.lastModified) {
                localMap.set(remote.id, remote);
                hasChanges = true;
              }
            });
            if (!hasChanges) return prev;
            const updated = Array.from(localMap.values()).sort((a, b) => b.lastModified - a.lastModified);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            return updated;
          });
        }
      } catch (err: any) {
        console.error("Failed to load projects from Supabase", err);
        setSyncError(err.message || 'Connection Timeout');
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
      if (!p) return;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
      if (!isUUID) return;

      setIsSyncing(true);
      try {
        const { error } = await supabase
          .from('projects')
          .upsert({
            id: p.id,
            user_id: user.id,
            name: p.name,
            chain: p.chain,
            contract_code: p.contractCode,
            files: p.files,
            versions: p.versions,
            audit_report: p.auditReport,
            deployed_address: p.deployedAddress,
            last_modified: Date.now()
          }, { onConflict: 'id' });
        if (error) throw error;
      } catch (err: any) {
        console.error("Failed to sync project to Supabase", err);
        setSyncError(err.message || 'Sync Error');
      } finally {
        setIsSyncing(false);
      }
    }
    const timeout = setTimeout(syncToSupabase, 1500);
    return () => clearTimeout(timeout);
  }, [projects, user, activeProjectId]);

  useEffect(() => {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(byokSettings));
  }, [byokSettings]);

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
    navigate(`/workspace/${projectId}`);
  };

  const handleCreateProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
    navigate(`/workspace/${project.id}`);
  };

  const handleMenuAction = (action: string) => {
    switch (action) {
      case 'New Project':
        setActiveProjectId(null);
        navigate('/creator');
        break;
      case 'Settings':
        setIsSettingsModalOpen(true);
        break;
      case 'Documentation':
        window.open('https://docs.nexops.cash', '_blank');
        break;
      case 'Publish to Registry':
        handlePublishToRegistry();
        break;
    }
  };

  const handlePublishToRegistry = async () => {
    if (!user) {
      toast.error("Please sign in to publish contracts to the registry.");
      return;
    }
    if (!activeProject) {
      toast.error("No active project to publish.");
      return;
    }
    setIsPublishModalOpen(true);
  };

  const onPerformPublish = async (details: { title: string; description: string; tags: string[] }) => {
    if (!user || !activeProject) return;
    setIsPublishingReg(true);
    try {
      const { error } = await supabase
        .from('contracts_registry')
        .insert({
          title: details.title,
          description: details.description,
          source_code: activeProject.contractCode,
          bytecode: activeProject.auditReport?.metadata?.contract_hash || "",
          artifact: activeProject.auditReport || {},
          compiler_version: "cashc v0.13.0",
          network: "testnet",
          audit: activeProject.auditReport || { score: 90 },
          tags: details.tags,
          author_id: user.id,
          version: "1.0.0",
          source_hash: crypto.randomUUID(),
          visibility: 'verified'
        });
      if (error) throw error;
      toast.success("Successfully published to the Verified Registry!");
      setIsPublishModalOpen(false);
    } catch (err) {
      console.error("Failed to publish contract:", err);
      toast.error("Error publishing contract.");
    } finally {
      setIsPublishingReg(false);
    }
  };

  const handleLoadFromRegistry = (contract: any) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Fork: ${contract.title}`,
      chain: ChainType.BCH_TESTNET,
      contractCode: contract.source_code,
      files: [{ name: 'contract.cash', content: contract.source_code, language: 'cashscript' }],
      versions: [{ id: 'fork', timestamp: Date.now(), fileName: 'contract.cash', code: contract.source_code, description: `Forked from Registry: ${contract.title}`, author: 'SYSTEM' }],
      lastModified: Date.now(),
      auditReport: contract.audit
    };
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    navigate(`/workspace/${newProject.id}`);
    toast.success(`Successfully loaded ${contract.title} into your workspace!`);
  };

  const handleNavigateHome = () => {
    setActiveProjectId(null);
    navigate('/');
  };

  const getActiveView = () => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/workspace')) return 'workspace';
    if (path.startsWith('/wizard')) return 'wizard';
    if (path.startsWith('/registry')) return 'registry';
    if (path.startsWith('/docs')) return 'docs';
    if (path.startsWith('/creator')) return 'creator';
    return 'home';
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-nexus-900">
      {!location.pathname.startsWith('/workspace') && (
        <TopNav
          isSyncing={isSyncing}
          syncError={syncError}
          activeView={getActiveView()}
          onNavigate={(view) => {
            if (view === 'workspace') {
              if (activeProjectId) navigate(`/workspace/${activeProjectId}`);
              else navigate('/creator');
            } else if (view === 'home') navigate('/');
            else navigate(`/${view}`);
          }}
        />
      )}

      {location.pathname.startsWith('/workspace') && activeProject && (
        <TopMenuBar
          isSyncing={isSyncing}
          syncError={syncError}
          activeProject={activeProject}
          onAction={handleMenuAction}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<LandingPage projects={projects} onSelectProject={handleSelectProject} onNavigateCreator={() => navigate('/creator')} onNavigateWizard={() => navigate('/wizard')} onNavigateRegistry={() => navigate('/registry')} />} />
          <Route path="/creator" element={<div className="h-full w-full bg-nexus-900 overflow-auto"><CreateProject onNavigate={handleNavigateHome} onCreateProject={handleCreateProject} /></div>} />
          <Route path="/workspace" element={<Navigate to={activeProjectId ? `/workspace/${activeProjectId}` : "/creator"} replace />} />
          <Route path="/workspace/:projectId" element={activeProject ? <ProjectWorkspace project={activeProject} onUpdateProject={handleUpdateProject} walletConnected={walletConnected} onConnectWallet={() => setWalletConnected(!walletConnected)} onNavigateHome={handleNavigateHome} onPublish={handlePublishToRegistry} byokSettings={byokSettings} /> : <Navigate to="/" replace />} />
          <Route path="/wizard" element={<WizardPage onNavigateHome={handleNavigateHome} onCreateProject={handleCreateProject} />} />
          <Route path="/registry" element={<RegistryPage onLoadContract={handleLoadFromRegistry} />} />
          <Route path="/docs" element={<Documentation />} />
        </Routes>
        {activeProject && <PublishModal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} onPublish={onPerformPublish} initialTitle={activeProject.name} isPublishing={isPublishingReg} />}
      </div>
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} settings={byokSettings} onSave={setByokSettings} />
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#0a0a0c', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
    </div>
  );
};

export default App;
