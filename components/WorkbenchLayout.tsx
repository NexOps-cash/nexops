import React, { useState, ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
    Files, ShieldCheck, BoxSelect, TerminalSquare,
    Settings, Play, Bot, FileCode, Rocket, GitBranch, Home
} from 'lucide-react';
import { StatusBar } from './StatusBar';
import { StatusBarState } from '../types';

interface WorkbenchLayoutProps {
    sidebarContent: ReactNode;
    editorContent: ReactNode;
    bottomPanelContent: ReactNode;
    activeView: 'EXPLORER' | 'AUDITOR' | 'DEBUG' | 'DEPLOY' | 'INTERACT' | 'FLOW';
    onViewChange: (view: 'EXPLORER' | 'AUDITOR' | 'DEBUG' | 'DEPLOY' | 'INTERACT' | 'FLOW') => void;
    problemsCount?: number;
    statusBarState?: StatusBarState;
    onNavigateHome?: () => void;
}

const ActivityBarItem = ({
    icon: Icon,
    label,
    shortcut,
    isActive,
    onClick
}: {
    icon: any,
    label: string,
    shortcut?: string,
    isActive: boolean,
    onClick: () => void
}) => (
    <div className="relative group flex justify-center">
        <button
            onClick={onClick}
            className={`p-2.5 w-12 flex justify-center items-center transition-colors relative ${isActive ? 'text-nexus-cyan' : 'text-slate-500 hover:text-slate-300'
                }`}
        >
            <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
            {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-nexus-cyan shadow-[0_0_10px_rgba(0,216,255,0.5)]"></div>
            )}
        </button>
        {/* Custom Tooltip */}
        <div className="absolute left-14 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center space-x-2 border border-slate-700">
            <span>{label}</span>
            {shortcut && <span className="text-[9px] text-slate-400 bg-black/40 px-1 rounded border border-white/10">{shortcut}</span>}
        </div>
    </div>
);

export const WorkbenchLayout: React.FC<WorkbenchLayoutProps> = ({
    sidebarContent,
    editorContent,
    bottomPanelContent,
    activeView,
    onViewChange,
    problemsCount = 0,
    statusBarState = {},
    onNavigateHome
}) => {
    const [isBottomOpen, setIsBottomOpen] = useState(true);

    return (
        <div className="flex flex-col h-full w-full bg-[#050507] text-slate-300 overflow-hidden font-sans">
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Activity Bar (Leftmost Strip) - Darkest Layer */}
                <div className="w-12 h-full max-h-screen flex-shrink-0 flex flex-col border-r border-white/5 bg-[#050507] z-50">
                    <div className="flex-shrink-0 pt-2 pb-2 border-b border-white/5">
                        <ActivityBarItem
                            icon={Home}
                            label="Home / Dashboard"
                            isActive={false}
                            onClick={() => onNavigateHome?.()}
                        />
                    </div>
                    <div className="flex-1 flex flex-col pt-2 space-y-2 overflow-y-auto no-scrollbar">
                        <ActivityBarItem
                            icon={Files}
                            label="Contracts (Explorer)"
                            shortcut="Ctrl+E"
                            isActive={activeView === 'EXPLORER'}
                            onClick={() => onViewChange('EXPLORER')}
                        />
                        <ActivityBarItem
                            icon={ShieldCheck}
                            label="AI / Auditor"
                            shortcut="Ctrl+K"
                            isActive={activeView === 'AUDITOR'}
                            onClick={() => onViewChange('AUDITOR')}
                        />
                        {/* <ActivityBarItem
                            icon={Play}
                            label="Contract Flow"
                            isActive={activeView === 'DEBUG'}
                            onClick={() => onViewChange('DEBUG')}
                        /> */}
                        <ActivityBarItem
                            icon={Rocket}
                            label="Deploy Panel"
                            isActive={activeView === 'DEPLOY'}
                            onClick={() => onViewChange('DEPLOY')}
                        />
                        <ActivityBarItem
                            icon={Play}
                            label="Transaction Builder"
                            isActive={activeView === 'INTERACT'}
                            onClick={() => onViewChange('INTERACT')}
                        />
                        <ActivityBarItem
                            icon={GitBranch}
                            label="Visual Flow Builder"
                            isActive={activeView === 'FLOW'}
                            onClick={() => onViewChange('FLOW')}
                        />
                    </div>
                    <div className="flex-shrink-0 pb-2 border-t border-slate-800/50">
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

                        {/* Sidebar Panel - Middle Layer */}
                        <Panel defaultSize={25} minSize={20} maxSize={50} className="bg-[#0a0a0c] border-r border-white/5 flex flex-col">
                            <div className="h-9 min-h-[36px] px-4 flex items-center border-b border-white/5 bg-black/20">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {activeView === 'EXPLORER' && 'Project Contracts'}
                                    {activeView === 'AUDITOR' && 'AI Security Agent'}
                                    {activeView === 'DEBUG' && 'Contract Flow'}
                                    {activeView === 'DEPLOY' && 'Deploy Contract'}
                                    {activeView === 'INTERACT' && 'Transaction Builder'}
                                    {activeView === 'FLOW' && 'Flow Palette'}
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
                                {/* Editor Area - Lightest Layer */}
                                <Panel defaultSize={70} minSize={30} className="bg-[#0f172a] flex flex-col shadow-2xl relative z-10">
                                    {editorContent}
                                </Panel>

                                <PanelResizeHandle className="h-px bg-white/5 hover:bg-nexus-cyan/20 transition-colors" />

                                {/* Bottom Panel (Console) */}
                                {isBottomOpen && activeView !== 'FLOW' && (
                                    <Panel defaultSize={30} minSize={10} className="bg-[#050507] border-t border-white/5">
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
            {/* Unified Status Bar */}
            <StatusBar state={statusBarState} />
        </div>
    );
};
