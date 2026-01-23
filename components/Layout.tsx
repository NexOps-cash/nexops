import React from 'react';
import { PageView } from '../types';

interface LayoutProps {
  currentView: PageView;
  children: React.ReactNode;
  // Keeping interface for backwards compatibility
  onNavigate?: (view: PageView) => void;
  walletConnected?: boolean;
  onConnectWallet?: () => void;
  projects?: any[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  children
}) => {
  const isWorkspace = currentView === PageView.PROJECT_WORKSPACE;

  return (
    <div className={`flex-1 w-full ${isWorkspace ? 'h-full overflow-hidden' : 'p-4 md:p-8 overflow-auto'}`}>
      {!isWorkspace && (
        <div className="max-w-7xl mx-auto mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            {currentView === PageView.DASHBOARD && "Command Center"}
            {currentView === PageView.GENERATOR && "Nex Generator"}
            {currentView === PageView.AUDITOR && "Nex Auditor"}
            {currentView === PageView.DEPLOYMENT && "Chain Gateway"}
            {currentView === PageView.DOCS && "Protocol Knowledge"}
            {currentView === PageView.SETTINGS && "Settings"}
            {currentView === PageView.CREATE_PROJECT && "Project Initialization"}
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">NexOps Protocol • AI-Powered BCH Development</p>
        </div>
      )}
      {children}
    </div>
  );
};
