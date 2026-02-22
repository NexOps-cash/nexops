import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Project } from '../types';

interface WorkspaceHeaderProps {
    project: Project;
    onNavigateHome: () => void;
}

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ project, onNavigateHome }) => {
    return (
        <div className="bg-[#050507] border-b border-white/5 px-6 py-2 flex items-center justify-between shrink-0 h-12">
            <div className="flex items-center space-x-8">
                <button
                    onClick={onNavigateHome}
                    className="flex items-center space-x-2 mr-4 group"
                >
                    <div className="w-6 h-6 bg-nexus-cyan/10 border border-nexus-cyan/20 rounded flex items-center justify-center group-hover:bg-nexus-cyan/20 transition-all">
                        <ShieldCheck className="w-4 h-4 text-nexus-cyan" />
                    </div>
                </button>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Project</span>
                    <span className="text-xs font-bold text-slate-300 tracking-tight">{project.name}</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Network</span>
                    <span className="text-xs font-mono text-nexus-cyan">BCH Mainnet</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Compiler</span>
                    <span className="text-xs font-mono text-slate-400">cashc v0.9.0</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Audit Engine</span>
                    <span className="text-xs font-mono text-slate-400">TollGate v0.3</span>
                </div>
                <div className="h-6 w-px bg-white/5" />
                <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Determinism</span>
                    <span className="text-xs font-bold text-green-500/80 italic">Template-Validated</span>
                </div>
            </div>

            <div className="flex items-center space-x-3 bg-nexus-cyan/5 px-3 py-1.5 rounded-md border border-nexus-cyan/20">
                <div className="relative">
                    <div className="w-2 h-2 bg-nexus-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    <div className="absolute inset-0 w-2 h-2 bg-nexus-cyan rounded-full animate-ping opacity-40" />
                </div>
                <span className="text-[10px] font-black text-nexus-cyan uppercase tracking-[0.2em]">NexOps Active</span>
            </div>
        </div>
    );
};
