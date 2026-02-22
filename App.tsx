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

type ViewState = 'home' | 'creator' | 'workspace' | 'wizard' | 'registry';

const STORAGE_KEY = 'nexops_protocol_v2';

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
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isPublishingReg, setIsPublishingReg] = useState(false);

  // Load projects from Supabase when user logs in
  useEffect(() => {
    async function loadProjects() {
      if (!user) {
        // Fallback to local storage if not logged in
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setProjects(JSON.parse(saved));
        } else {
          setProjects([]);
          setActiveProjectId(null);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('last_modified', { ascending: false });

        if (error) throw error;

        // Map database row to Project type
        if (data) {
          const mappedProjects: Project[] = data.map(row => ({
            id: row.id,
            name: row.name,
            chain: row.chain,
            contractCode: row.contract_code,
            files: row.files || [],
            versions: row.versions || [],
            auditReport: row.audit_report,
            deployedAddress: row.deployed_address,
            lastModified: row.last_modified
          }));
          setProjects(mappedProjects);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mappedProjects)); // Update cache
        }
      } catch (err) {
        console.error("Failed to load projects from Supabase", err);
      }
    }

    loadProjects();
  }, [user]);

  // Sync projects to Supabase (and localStorage) on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

    async function syncToSupabase() {
      if (!user || projects.length === 0 || isSyncing) return;

      // Only sync the active project to avoid overwhelming the DB
      const p = projects.find(p => p.id === activeProjectId);
      if (!p) return;

      // Ensure valid UUID (Postgres will crash on timestamp strings)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
      if (!isUUID) {
        console.warn(`Skipping sync for legacy project ID: ${p.id}. Please recreate the project.`);
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
      } catch (err) {
        console.error("Failed to sync project to Supabase", err);
      } finally {
        setIsSyncing(false);
      }
    }

    // Debounce the sync slightly
    const timeout = setTimeout(syncToSupabase, 1000);
    return () => clearTimeout(timeout);
  }, [projects, user, activeProjectId]);

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
        // TODO: Open settings overlay
        console.log('Settings overlay (to be implemented)');
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
          compiler_version: "cashc v0.9.0",
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
      <TopNav
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

      {currentView === 'workspace' && activeProject && (
        <TopMenuBar
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
    </div>
  );
};

export default App;
