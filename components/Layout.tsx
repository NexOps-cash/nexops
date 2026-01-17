
import React, { useState } from 'react';
import { 
  Terminal, 
  ShieldCheck, 
  Cpu, 
  Rocket, 
  BookOpen, 
  Settings, 
  Menu,
  Wallet,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  FileCode,
  LayoutDashboard
} from 'lucide-react';
import { PageView, Project } from '../types';

interface LayoutProps {
  currentView: PageView;
  onNavigate: (view: PageView) => void;
  children: React.ReactNode;
  walletConnected: boolean;
  onConnectWallet: () => void;
  projects?: Project[];
  activeProjectId?: string | null;
  onSelectProject?: (id: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ 
  currentView, 
  onNavigate, 
  children,
  walletConnected,
  onConnectWallet,
  projects = [],
  activeProjectId,
  onSelectProject
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const isWorkspace = currentView === PageView.PROJECT_WORKSPACE;

  const NavItem = ({ view, icon: Icon, label, isActive, onClick }: { view?: PageView, icon: any, label: string, isActive?: boolean, onClick?: () => void }) => {
    const active = isActive || (view && currentView === view);
    return (
      <button
        onClick={() => {
          if (onClick) {
            onClick();
          } else if (view) {
            onNavigate(view);
          }
          setMobileMenuOpen(false);
        }}
        className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all relative group ${
          active 
            ? 'bg-nexus-cyan/15 text-nexus-cyan ring-1 ring-nexus-cyan/30' 
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
        title={isSidebarCollapsed ? label : ''}
      >
        <Icon size={18} className="flex-shrink-0" />
        {!isSidebarCollapsed && <span className="text-sm font-medium truncate">{label}</span>}
        {isSidebarCollapsed && (
          <div className="absolute left-16 bg-nexus-800 border border-nexus-700 px-3 py-1.5 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap shadow-2xl scale-95 group-hover:scale-100">
            {label}
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-nexus-900 flex text-gray-100 font-sans selection:bg-nexus-cyan/30">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden md:flex flex-col border-r border-slate-800/50 bg-nexus-800 fixed h-full z-40 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className={`p-6 flex items-center border-b border-slate-800/50 ${isSidebarCollapsed ? 'justify-center px-0' : 'space-x-3'}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center flex-shrink-0 shadow-lg shadow-nexus-cyan/20">
            <Cpu className="text-white w-5 h-5" />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tighter text-white leading-none">NexOps</span>
              <span className="text-[10px] font-bold text-nexus-cyan/80 tracking-widest uppercase mt-0.5">Protocol</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto no-scrollbar">
          <NavItem view={PageView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          
          <div className="pt-4 pb-2">
            {!isSidebarCollapsed && <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-4">Development</div>}
            <NavItem 
                view={PageView.CREATE_PROJECT} 
                icon={PlusCircle} 
                label="New Project" 
                isActive={currentView === PageView.CREATE_PROJECT}
            />
            
            {!isSidebarCollapsed && projects.length > 0 && (
                <div className="mt-3 space-y-1 pl-2">
                    {projects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => onSelectProject?.(p.id)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-xs flex items-center space-x-3 transition-all ${
                                activeProjectId === p.id && isWorkspace
                                ? 'text-nexus-cyan bg-nexus-cyan/10 font-bold'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                            }`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${activeProjectId === p.id && isWorkspace ? 'bg-nexus-cyan animate-pulse' : 'bg-slate-700'}`}></div>
                            <span className="truncate">{p.name}</span>
                        </button>
                    ))}
                </div>
            )}
          </div>
          
          <div className="pt-4 border-t border-slate-800/50">
            {!isSidebarCollapsed && <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 ml-4">Automation</div>}
            <NavItem view={PageView.GENERATOR} icon={Cpu} label="Nex Generator" />
            <NavItem view={PageView.AUDITOR} icon={ShieldCheck} label="Nex Auditor" />
            <NavItem view={PageView.DEPLOYMENT} icon={Rocket} label="Chain Deploy" />
          </div>
          
          <div className="pt-4 border-t border-slate-800/50">
            <NavItem view={PageView.DOCS} icon={BookOpen} label="Knowledge" />
            <NavItem view={PageView.SETTINGS} icon={Settings} label="Configuration" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800/50 space-y-4">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-xl bg-nexus-900/50 border border-slate-700 hover:text-nexus-cyan hover:border-nexus-cyan/30 transition-all group"
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <div className="flex items-center text-xs font-bold uppercase tracking-wider"><ChevronLeft size={16} className="mr-2" /> Collapse</div>}
          </button>
          
          {!isSidebarCollapsed && (
            <div className="bg-nexus-900 p-3 rounded-xl border border-slate-800 flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-black">DX</div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold truncate">Developer Node</p>
                <p className="text-[9px] text-nexus-cyan font-bold tracking-tight">Status: Online</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main 
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        } ${isWorkspace ? 'h-screen overflow-hidden' : 'p-4 md:p-8'}`}
      >
        {!isWorkspace && (
          <div className="max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
              <div>
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
              
              <button 
                onClick={onConnectWallet}
                className={`flex items-center px-6 py-2.5 rounded-full border text-sm font-bold transition-all shadow-xl ${
                  walletConnected 
                  ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan ring-1 ring-nexus-cyan/20' 
                  : 'bg-nexus-800 border-slate-700 text-slate-300 hover:border-nexus-cyan/50'
                }`}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {walletConnected ? "Connected: 0x71C...39A2" : "Connect Provider"}
              </button>
            </header>
            {children}
          </div>
        )}
        {isWorkspace && children}
      </main>
    </div>
  );
};
