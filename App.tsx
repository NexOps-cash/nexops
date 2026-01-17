
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Generator } from './pages/Generator';
import { Auditor } from './pages/Auditor';
import { Deployment } from './pages/Deployment';
import { Documentation } from './pages/Documentation';
import { CreateProject } from './pages/CreateProject';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { PageView, Project, AuditReport } from './types';
import { Card, Button } from './components/UI';

const STORAGE_KEY = 'nexops_protocol_v2';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<PageView>(PageView.DASHBOARD);
  
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
    setCurrentView(PageView.PROJECT_WORKSPACE);
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
    setCurrentView(PageView.PROJECT_WORKSPACE);
  };

  const handleRequestFix = (project: Project, report: AuditReport) => {
      const instructions = report.vulnerabilities
        .map(v => `- [${v.severity}] ${v.title}: ${v.fixSuggestion}`)
        .join('\n');
      
      const fixingProject = {
          ...project,
          isFixing: true,
          fixInstructions: instructions
      };
      
      handleUpdateProject(fixingProject);
      setCurrentView(PageView.GENERATOR);
  };

  const renderContent = () => {
    switch (currentView) {
      case PageView.DASHBOARD:
        return <Dashboard onNavigate={setCurrentView} projects={projects} onSelectProject={handleSelectProject} />;
      case PageView.GENERATOR:
        return (
            <Generator 
                activeProject={activeProject}
                onProjectCreate={handleCreateProject} 
                onProjectUpdate={handleUpdateProject}
                onNavigate={setCurrentView} 
            />
        );
      case PageView.AUDITOR:
        return (
            <Auditor 
                project={activeProject} 
                onUpdateProject={handleUpdateProject} 
                onNavigate={setCurrentView} 
                onRequestFix={handleRequestFix}
                onCreateProject={handleCreateProject}
            />
        );
      case PageView.DEPLOYMENT:
        return <Deployment project={activeProject} walletConnected={walletConnected} />;
      case PageView.DOCS:
        return <Documentation />;
      case PageView.CREATE_PROJECT:
        return <CreateProject onNavigate={setCurrentView} onCreateProject={handleCreateProject} />;
      case PageView.PROJECT_WORKSPACE:
        if (!activeProject) return <Dashboard onNavigate={setCurrentView} projects={projects} onSelectProject={handleSelectProject} />;
        return (
            <ProjectWorkspace 
                project={activeProject}
                onUpdateProject={handleUpdateProject}
                onNavigate={setCurrentView}
            />
        );
      case PageView.SETTINGS:
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <Card>
              <h2 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Protocol Configuration</h2>
              <div className="space-y-4">
                <div className="p-4 bg-nexus-900 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Compute Layer</p>
                  <p className="text-white font-bold">Local Persistence Enabled</p>
                </div>
                <div className="p-4 bg-nexus-900 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Protocol Gateway</p>
                  <p className="text-white font-bold">Gemini-3-Pro-Nexus</p>
                </div>
              </div>
              <Button 
                  variant="danger" 
                  className="mt-8 w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest" 
                  onClick={() => {
                      if(confirm("Factory Reset NexOps? This will permanently delete all local projects and history.")) {
                          setProjects([]);
                          setActiveProjectId(null);
                          localStorage.removeItem(STORAGE_KEY);
                          setCurrentView(PageView.DASHBOARD);
                      }
                  }}
              >
                  Factory Reset Protocol Data
              </Button>
            </Card>
          </div>
        );
      default:
        return <Dashboard onNavigate={setCurrentView} projects={projects} onSelectProject={handleSelectProject} />;
    }
  };

  return (
    <Layout 
      currentView={currentView} 
      onNavigate={setCurrentView}
      walletConnected={walletConnected}
      onConnectWallet={() => setWalletConnected(!walletConnected)}
      projects={projects}
      activeProjectId={activeProjectId}
      onSelectProject={handleSelectProject}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
