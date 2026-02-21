import React, { useState, ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
    Files, ShieldCheck, BoxSelect, TerminalSquare,
    Settings, Play, Bot, FileCode, Rocket
} from 'lucide-react';

interface WorkbenchLayoutProps {
    sidebarContent: ReactNode;
    editorContent: ReactNode;
    bottomPanelContent: ReactNode;
    activeView: 'EXPLORER' | 'AUDITOR' | 'DEBUG' | 'DEPLOY' | 'INTERACT';
    onViewChange: (view: 'EXPLORER' | 'AUDITOR' | 'DEBUG' | 'DEPLOY' | 'INTERACT') => void;
    problemsCount?: number;
}

const ActivityBarItem = ({
    icon: Icon,
    label,
    isActive,
    onClick
}: {
    icon: any,
    label: string,
    isActive: boolean,
    onClick: () => void
}) => (
    <button
        onClick={onClick}
        className={`p-3 w-12 flex justify-center items-center transition-colors relative group ${isActive ? 'text-nexus-cyan' : 'text-slate-500 hover:text-slate-300'
            }`}
        title={label}
    >
        <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
        {isActive && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-nexus-cyan shadow-[0_0_10px_rgba(0,216,255,0.5)]"></div>
        )}
    </button>
);

export const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({
    sidebarContent,
    editorContent,
    bottomPanelContent,
    activeView,
    onViewChange,
    problemsCount = 0,
}) => {
    const [isBottomOpen, setIsBottomOpen] = useState(true);

    return (
        <div className="flex h-screen w-screen bg-nexus-900 text-slate-300 overflow-hidden font-sans">
            {/* Activity Bar (Leftmost Strip) */}
            <div className="w-12 flex-shrink-0 flex flex-col border-r border-slate-800 bg-nexus-900 z-10">
                <div className="flex-1 flex flex-col pt-2 space-y-2">
                    <ActivityBarItem
                        icon={Files}
                        label="Contracts (Explorer)"
                        isActive={activeView === 'EXPLORER'}
                        onClick={() => onViewChange('EXPLORER')}
                    />
                    <ActivityBarItem
                        icon={ShieldCheck}
                        label="AI / Auditor"
                        isActive={activeView === 'AUDITOR'}
                        onClick={() => onViewChange('AUDITOR')}
                    />
                    <ActivityBarItem
                        icon={Play}
                        label="Execution Trace"
                        isActive={activeView === 'DEBUG'}
                        onClick={() => onViewChange('DEBUG')}
                    />
                    <ActivityBarItem
                        icon={Rocket}
                        label="Deploy Contract"
                        isActive={activeView === 'DEPLOY'}
                        onClick={() => onViewChange('DEPLOY')}
                    />
                    <ActivityBarItem
                        icon={BoxSelect}
                        label="Interact (Builder)"
                        isActive={activeView === 'INTERACT'}
                        onClick={() => onViewChange('INTERACT')}
                    />
                </div>
                <div className="pb-2">
                    <ActivityBarItem
                        icon={Settings}
                        label="Settings"
                        isActive={false}
                        onClick={() => { }}
                    />
                </div>
            </div>

            {/* Main Resizable Content */}
            <div className="flex-1 min-w-0 h-full">
                <PanelGroup direction="horizontal">

                    {/* Sidebar Panel */}
                    <Panel defaultSize={25} minSize={20} maxSize={50} className="bg-nexus-800 border-r border-slate-800 flex flex-col">
                        <div className="h-9 min-h-[36px] px-4 flex items-center border-b border-slate-800 bg-nexus-800/50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {activeView === 'EXPLORER' && 'Project Contracts'}
                                {activeView === 'AUDITOR' && 'AI Security Agent'}
                                {activeView === 'DEBUG' && 'Execution Trace'}
                                {activeView === 'DEPLOY' && 'Deploy Contract'}
                                {activeView === 'INTERACT' && 'Transaction Builder'}
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden relative">
                            {sidebarContent}
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-1 bg-transparent hover:bg-nexus-cyan/20 transition-colors" />

                    {/* Editor & Bottom Panel Group */}
                    <Panel minSize={30}>
                        <PanelGroup direction="vertical">
                            {/* Editor Area */}
                            <Panel defaultSize={70} minSize={30} className="bg-nexus-900 flex flex-col">
                                {editorContent}
                            </Panel>

                            <PanelResizeHandle className="h-1 bg-slate-800 hover:bg-nexus-cyan/20 transition-colors" />

                            {/* Bottom Panel (Console) */}
                            {isBottomOpen && (
                                <Panel defaultSize={30} minSize={10} className="bg-[#0a0a0c] border-t border-slate-800/50">
                                    <div className="h-full relative overflow-hidden">
                                        {bottomPanelContent}
                                    </div>
                                </Panel>
                            )}
                        </PanelGroup>
                    </Panel>

                </PanelGroup>
            </div>
        </div>
    );
};
