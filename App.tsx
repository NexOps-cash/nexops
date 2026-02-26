import React, { useState, useEffect } from 'react';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { Project, ChainType } from './types';
import { TopMenuBar } from './components/TopMenuBar';
import { supabase } from './lib/supabase';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { CreateProject } from './pages/CreateProject';
import { RegistryPage } from './pages/RegistryPage';
import { WizardPage } from './pages/WizardPage';
import { PublishModal } from './components/PublishModal';
import { TopNav } from './components/TopNav';
import { WorkspaceHeader } from './components/WorkspaceHeader';
import { Toaster } from 'react-hot-toast';
import { SettingsModal } from './components/SettingsModal';
import { BYOKSettings } from './types';

type ViewState = 'home' | 'creator' | 'workspace' | 'wizard' | 'registry';

const STORAGE_KEY = 'nexops_protocol_v2';
const BYOK_STORAGE_KEY = 'nexops_byok_settings';

const App: React.FC = () => {
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
  const [currentView, setCurrentView] = useState<ViewState>('home');
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

  // Load projects from Supabase when user logs in
  useEffect(() => {
    async function loadProjects() {
      setSyncError(null);

      // Always start with local storage for instant perceived performance
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

          // Merge logic: For each remote project, update local if remote is newer or local doesn't exist
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
        // We already loaded local storage at the start, so we just show the error
      }
    }

    loadProjects();
  }, [user]);

  // Sync projects to Supabase (and localStorage) on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

    async function syncToSupabase() {
      if (!user || projects.length === 0 || isSyncing) return;
      setSyncError(null);

      const p = projects.find(row => row.id === activeProjectId);
      if (!p) return;

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
      if (!isUUID) {
        console.warn(`Skipping sync for legacy project ID: ${p.id}.`);
        return;
      }

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

  // Persist BYOK Settings
  useEffect(() => {
    localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(byokSettings));
  }, [byokSettings]);

  // Derived active project
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
    setCurrentView('workspace');
  };

  const handleCreateProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
    setCurrentView('workspace');
  };

  const handleMenuAction = (action: string) => {
    console.log('Menu action:', action);

    switch (action) {
      case 'New Project':
        setActiveProjectId(null);
        setCurrentView('creator');
        break;
      case 'Settings':
        setIsSettingsModalOpen(true);
        break;
      case 'Documentation':
        // TODO: Open docs overlay
        console.log('Documentation overlay (to be implemented)');
        break;
      case 'Save':
        console.log('Save triggered');
        break;
      case 'Publish to Registry':
        handlePublishToRegistry();
        break;
      default:
        console.log(`Unhandled action: ${action}`);
    }
  };

  const handlePublishToRegistry = async () => {
    if (!user) {
      alert("Please sign in to publish contracts to the registry.");
      return;
    }
    if (!activeProject) {
      alert("No active project to publish.");
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
          source_hash: activeProject.auditReport?.metadata?.contract_hash || crypto.randomUUID(),
          visibility: 'verified'
        });

      if (error) throw error;
      alert("Successfully published to the Verified Registry!");
      setIsPublishModalOpen(false);
    } catch (err) {
      console.error("Failed to publish contract:", err);
      alert("Error publishing contract. Check console for details.");
    } finally {
      setIsPublishingReg(false);
    }
  };

  const handleLoadFromRegistry = (contract: any) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Fork: ${contract.title}`,
      chain: contract.network === 'mainnet' ? ChainType.BCH_TESTNET : ChainType.BCH_TESTNET, // Defaulting to testnet for safety
      contractCode: contract.source_code,
      files: [
        {
          name: 'contract.cash',
          content: contract.source_code,
          language: 'cashscript'
        }
      ],
      versions: [
        {
          id: 'fork',
          timestamp: Date.now(),
          fileName: 'contract.cash',
          code: contract.source_code,
          description: `Forked from Registry: ${contract.title}`,
          author: 'SYSTEM'
        }
      ],
      lastModified: Date.now(),
      auditReport: contract.audit
    };

    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setCurrentView('workspace');
    alert(`Successfully loaded ${contract.title} into your workspace!`);
  };

  const handleNavigateHome = () => {
    setActiveProjectId(null);
    setCurrentView('home');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-nexus-900">
      {currentView !== 'workspace' && (
        <TopNav
          isSyncing={isSyncing}
          syncError={syncError}
          activeView={currentView}
          onNavigate={(view) => {
            if (view === 'workspace') {
              if (activeProjectId) setCurrentView('workspace');
              else setCurrentView('creator');
            } else {
              setCurrentView(view);
            }
          }}
        />
      )}

      {currentView === 'workspace' && activeProject && (
        <TopMenuBar
          isSyncing={isSyncing}
          syncError={syncError}
          activeProject={activeProject}
          onAction={handleMenuAction}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {currentView === 'home' && (
          <LandingPage
            projects={projects}
            onSelectProject={handleSelectProject}
            onNavigateCreator={() => setCurrentView('creator')}
            onNavigateWizard={() => setCurrentView('wizard')}
            onNavigateRegistry={() => setCurrentView('registry')}
          />
        )}

        {currentView === 'creator' && (
          <div className="h-full w-full bg-nexus-900 overflow-auto">
            <CreateProject
              onNavigate={handleNavigateHome}
              onCreateProject={handleCreateProject}
            />
          </div>
        )}

        {currentView === 'workspace' && activeProject && (
          <ProjectWorkspace
            project={activeProject}
            onUpdateProject={handleUpdateProject}
            walletConnected={walletConnected}
            onConnectWallet={() => setWalletConnected(!walletConnected)}
            onNavigateHome={handleNavigateHome}
            onPublish={handlePublishToRegistry}
            byokSettings={byokSettings}
          />
        )}

        {currentView === 'wizard' && (
          <WizardPage
            onNavigateHome={handleNavigateHome}
            onCreateProject={handleCreateProject}
          />
        )}

        {currentView === 'registry' && (
          <RegistryPage onLoadContract={handleLoadFromRegistry} />
        )}

        {activeProject && (
          <PublishModal
            isOpen={isPublishModalOpen}
            onClose={() => setIsPublishModalOpen(false)}
            onPublish={onPerformPublish}
            initialTitle={activeProject.name}
            isPublishing={isPublishingReg}
          />
        )}
      </div>
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={byokSettings}
        onSave={setByokSettings}
      />
      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: '#0a0a0c',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      }} />
    </div>
  );
};

export default App;
