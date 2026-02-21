import React from 'react';
import { GitMerge, Cpu, Terminal, FileCode, Satellite } from 'lucide-react';
import { StatusBarState } from '../types';

interface StatusBarProps {
    state: StatusBarState;
}

export const StatusBar: React.FC<StatusBarProps> = ({ state }) => {
    const {
        activeFileName,
        isModified,
        encoding = 'UTF-8',
        language = 'CashScript',
        gitBranch = 'main',
        activeChannel = 'SYSTEM',
        isTerminalActive = true
    } = state;

    return (
        <div className="h-6 w-full bg-[#0d0d0f] border-t border-white/5 flex items-center justify-between px-3 text-[10px] text-slate-500 font-mono z-[100]">
            {/* Left Side: Indicator & Git */}
            <div className="flex items-center h-full">
                {/* Blue Indicator Strip (VS Code style) */}
                <div className="flex items-center bg-nexus-cyan/10 px-2 h-full mr-3 border-x border-nexus-cyan/20">
                    <span className="flex items-center gap-1.5 text-nexus-cyan font-bold uppercase tracking-tight">
                        <Satellite size={10} className="animate-pulse" />
                        NexOps Active
                    </span>
                </div>

                <div className="flex items-center space-x-4">
                    <span className="flex items-center gap-1.5 hover:text-slate-300 cursor-pointer transition-colors">
                        <GitMerge size={10} />
                        {gitBranch}
                    </span>

                    {activeFileName && (
                        <span className="flex items-center gap-1.5 text-slate-400">
                            <FileCode size={10} />
                            {activeFileName}
                            {isModified && (
                                <span className="w-1.5 h-1.5 rounded-full bg-nexus-warning animate-pulse" title="Unsaved changes" />
                            )}
                        </span>
                    )}
                </div>
            </div>

            {/* Right Side: Language & Terminal Info */}
            <div className="flex items-center space-x-4 h-full">
                {isTerminalActive && (
                    <div className="flex items-center gap-3 border-l border-white/10 pl-4 h-4">
                        <span className="flex items-center gap-1.5 text-green-500/80">
                            <Terminal size={10} />
                            {activeChannel}
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-4 border-l border-white/10 pl-4 h-4">
                    <span className="hover:text-slate-300 cursor-pointer">{encoding}</span>
                    <span className="hover:text-slate-300 cursor-pointer uppercase">{language}</span>
                </div>
            </div>
        </div>
    );
};
