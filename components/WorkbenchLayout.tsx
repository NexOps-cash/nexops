
import React, { useState, ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
    Files, ShieldCheck, BoxSelect, TerminalSquare,
    Settings, Play, Bot, FileCode
} from 'lucide-react';

interface WorkbenchLayoutProps {
    sidebarContent: ReactNode;
    editorContent: ReactNode;
    bottomPanelContent: ReactNode;
    activeView: 'EXPLORER' | 'AUDITOR' | 'DEBUG';
    onViewChange: (view: 'EXPLORER' | 'AUDITOR' | 'DEBUG') => void;
    activeBottomTab?: 'TERMINAL' | 'OUTPUT' | 'PROBLEMS';
    onTabChange?: (tab: 'TERMINAL' | 'OUTPUT' | 'PROBLEMS') => void;
    problemsCount?: number;
    problemsContent?: ReactNode;
    outputLogs?: string[];
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
    activeBottomTab = 'TERMINAL', // Default
    onTabChange,
    problemsCount = 0,
    problemsContent,
    outputLogs = []
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
                    <Panel defaultSize={20} minSize={15} maxSize={30} className="bg-nexus-800 border-r border-slate-800 flex flex-col">
                        <div className="h-9 min-h-[36px] px-4 flex items-center border-b border-slate-800 bg-nexus-800/50">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {activeView === 'EXPLORER' && 'Project Contracts'}
                                {activeView === 'AUDITOR' && 'AI Security Agent'}
                                {activeView === 'DEBUG' && 'Execution Trace'}
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

                            {/* Bottom Panel (Terminal / Output) */}
                            {isBottomOpen && (
                                <Panel defaultSize={30} minSize={10} className="bg-black/40 border-t border-slate-800">
                                    <div className="h-full flex flex-col">
                                        <div className="h-8 min-h-[32px] flex items-center px-4 border-b border-slate-800 bg-nexus-900/50 space-x-1">
                                            <button
                                                onClick={() => activeBottomTab !== 'TERMINAL' && onTabChange && onTabChange('TERMINAL')}
                                                className={`text-[10px] font-bold uppercase tracking-wider h-full px-3 transition-colors border-b-2 flex items-center space-x-2 ${activeBottomTab === 'TERMINAL' ? 'text-nexus-cyan border-nexus-cyan' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                            >
                                                <TerminalSquare size={12} className="mr-1" />
                                                <span>Terminal</span>
                                            </button>

                                            <button
                                                onClick={() => activeBottomTab !== 'OUTPUT' && onTabChange && onTabChange('OUTPUT')}
                                                className={`text-[10px] font-bold uppercase tracking-wider h-full px-3 transition-colors border-b-2 ${activeBottomTab === 'OUTPUT' ? 'text-nexus-cyan border-nexus-cyan' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                            >
                                                Output
                                            </button>

                                            <button
                                                onClick={() => activeBottomTab !== 'PROBLEMS' && onTabChange && onTabChange('PROBLEMS')}
                                                className={`text-[10px] font-bold uppercase tracking-wider h-full px-3 transition-colors border-b-2 flex items-center ${activeBottomTab === 'PROBLEMS' ? 'text-nexus-cyan border-nexus-cyan' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                                            >
                                                Problems
                                                {problemsCount > 0 && (
                                                    <span className="ml-2 bg-nexus-warning text-nexus-900 px-1.5 py-0.5 rounded-full text-[9px]">{problemsCount}</span>
                                                )}
                                            </button>

                                            <div className="flex-1" />
                                            <button onClick={() => setIsBottomOpen(false)} className="text-slate-500 hover:text-white">
                                                <TerminalSquare size={12} />
                                            </button>
                                        </div>
                                        <div className="flex-1 p-0 overflow-hidden relative">
                                            {activeBottomTab === 'TERMINAL' && bottomPanelContent}
                                            {activeBottomTab === 'OUTPUT' && (
                                                <div className="p-4 font-mono text-xs text-slate-400 h-full overflow-y-auto custom-scrollbar">
                                                    {outputLogs && outputLogs.length > 0 ? (
                                                        outputLogs.map((log, i) => (
                                                            <div key={i} className="whitespace-pre-wrap mb-1">{log}</div>
                                                        ))
                                                    ) : (
                                                        <div className="opacity-50">No output logs.</div>
                                                    )}
                                                </div>
                                            )}
                                            {activeBottomTab === 'PROBLEMS' && problemsContent}
                                        </div>
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
