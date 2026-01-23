import React, { useState, useEffect } from 'react';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { Project } from './types';
import { TopMenuBar } from './components/TopMenuBar';
import { ProjectPicker } from './components/ProjectPicker';

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
  const [walletConnected, setWalletConnected] = useState(false);

  // Sync projects to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  // Derived active project
  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const handleCreateProject = (project: Project) => {
    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
  };

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
  };

  const handleMenuAction = (action: string) => {
    console.log('Menu action:', action);

    switch (action) {
      case 'New Project':
        setActiveProjectId(null); // Go back to project picker
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
      default:
        console.log(`Unhandled action: ${action}`);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-nexus-900">
      <TopMenuBar
        activeProject={activeProject}
        onAction={handleMenuAction}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeProject ? (
          <ProjectWorkspace
            project={activeProject}
            onUpdateProject={handleUpdateProject}
            walletConnected={walletConnected}
            onConnectWallet={() => setWalletConnected(!walletConnected)}
          />
        ) : (
          <ProjectPicker
            projects={projects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
          />
        )}
      </div>
    </div>
  );
};

export default App;
