import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import {
    Folder, Plus, Clock, Terminal, Wand2, Globe,
    ArrowRight, ShieldCheck, Cpu, Code2, Database
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import Hyperspeed from '../components/Hyperspeed';

interface LandingPageProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onNavigateCreator: () => void;
    onNavigateWizard: () => void;
    onNavigateRegistry: () => void;
}

const HYPERSPEED_OPTIONS = {
    onSpeedUp: () => { },
    onSlowDown: () => { },
    distortion: 'turbulentDistortion' as const,
    length: 400,
    roadWidth: 10,
    islandWidth: 2,
    lanesPerRoad: 3,
    fov: 90,
    fovSpeedUp: 150,
    speedUp: 2,
    carLightsFade: 0.4,
    totalSideLightSticks: 20,
    lightPairsPerRoadWay: 40,
    shoulderLinesWidthPercentage: 0.05,
    brokenLinesWidthPercentage: 0.1,
    brokenLinesLengthPercentage: 0.5,
    lightStickWidth: [0.12, 0.5] as [number, number],
    lightStickHeight: [1.3, 1.7] as [number, number],
    movingAwaySpeed: [60, 80] as [number, number],
    movingCloserSpeed: [-120, -160] as [number, number],
    carLightsLength: [12, 80] as [number, number],
    carLightsRadius: [0.05, 0.14] as [number, number],
    carWidthPercentage: [0.3, 0.5] as [number, number],
    carShiftX: [-0.8, 0.8] as [number, number],
    carFloorSeparation: [0, 5] as [number, number],
    colors: {
        roadColor: 0x080808,
        islandColor: 0x0a0a0a,
        background: 0x000000,
        shoulderLines: 0x00E3A5,
        brokenLines: 0x00E3A5,
        leftCars: [0x00E3A5, 0x00A878, 0x00FFB2],
        rightCars: [0x03b3c3, 0x0e5ea5, 0x324555],
        sticks: 0x00E3A5
    }
};

const NumberCounter: React.FC<{ target: number }> = ({ target }) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const duration = 1000;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [target]);
    return <>{count}</>;
};

export const LandingPage: React.FC<LandingPageProps> = ({
    projects,
    onSelectProject,
    onNavigateCreator,
    onNavigateWizard,
    onNavigateRegistry
}) => {
    const [registryCount, setRegistryCount] = useState<number>(0);

    useEffect(() => {
        const fetchCount = async () => {
            const { count } = await supabase
                .from('contracts_registry')
                .select('*', { count: 'exact', head: true });
            setRegistryCount(count || 0);
        };
        fetchCount();
    }, []);

    return (
        <div className="h-full w-full bg-nexus-900 overflow-auto relative">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 opacity-25 pointer-events-none overflow-hidden">
                <Hyperspeed effectOptions={HYPERSPEED_OPTIONS} />
            </div>
            <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />

            <div className="max-w-6xl w-full mx-auto p-12 space-y-24 relative z-10">

                {/* 1. Protocol Hero Section */}
                <div className="text-center space-y-6 pt-10 pb-12 relative overflow-hidden">
                    <div className="space-y-2 relative z-10">
                        {/* Layered Depth: BCH Watermark & Radial Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-green-500/[0.03] blur-[150px] pointer-events-none -z-10" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-nexus-cyan/5 blur-[80px] pointer-events-none -z-10" />

                        {/* Subtle BCH SVG Watermark */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-32 h-32 text-green-500/[0.04] pointer-events-none -z-10">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-11h8v2h-8zM8 11h8v2H8zm0 2h5v2H8z" />
                            </svg>
                        </div>

                        <h1
                            className="text-6xl md:text-7xl font-black text-white tracking-tighter leading-[0.9]"
                            style={{ textShadow: '0 0 40px rgba(0,227,165,0.15)' }}
                        >
                            NexOps
                        </h1>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-400 tracking-tighter leading-[0.9] opacity-90">
                            Deterministic Contract Infrastructure
                        </h2>
                        <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-[0.9]">
                            for Bitcoin Cash
                        </h3>
                    </div>

                    <div className="space-y-6">
                        <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto font-medium leading-relaxed">
                            Build. Verify. Publish. Securely.<br />
                            <span className="text-slate-400/80 text-base">A security-first platform for creating and distributing audited CashScript contracts.</span>
                        </p>

                        {/* Enhanced Built for BCH Badge */}
                        <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-green-500/10 backdrop-blur-md border border-green-500/20 text-[10px] uppercase tracking-[0.25em] font-black text-green-400 shadow-[0_0_20px_rgba(34,197,94,0.1)] animate-in zoom-in-95 duration-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-400 mr-2 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                            Built for BCH
                        </div>
                    </div>
                </div>

                {/* 5. Protocol Status Strip */}
                <div className="border-y border-white/5 py-5 flex flex-wrap justify-center gap-x-12 gap-y-4">
                    <div className="flex items-center text-[10px] md:text-xs font-mono text-nexus-cyan uppercase tracking-[0.2em] group">
                        <ShieldCheck className="w-3.5 h-3.5 mr-2 opacity-90 brightness-125 group-hover:text-nexus-cyan transition-colors" />
                        <span className="opacity-70 mr-1.5 animate-pulse text-nexus-cyan">✓</span> Deterministic DSL Engine
                    </div>
                    <div className="flex items-center text-[10px] md:text-xs font-mono text-nexus-purple uppercase tracking-[0.2em] group">
                        <Cpu className="w-3.5 h-3.5 mr-2 opacity-90 brightness-125 group-hover:text-nexus-purple transition-colors" />
                        <span className="opacity-70 mr-1.5 animate-pulse text-nexus-purple">✓</span> TollGate Audit Engine v0.3
                    </div>
                    <div className="flex items-center text-[10px] md:text-xs font-mono text-green-400 uppercase tracking-[0.2em] group">
                        <Database className="w-3.5 h-3.5 mr-2 opacity-90 brightness-125 group-hover:text-green-400 transition-colors" />
                        <span className="opacity-70 mr-1.5 animate-pulse text-green-400">✓</span> Verified Contracts: <span className="ml-1 text-white group-hover:text-green-300 transition-colors"><NumberCounter target={registryCount} /></span>
                    </div>
                </div>

                {/* 2 & 3. Asymmetric Card Hierarchy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">

                    {/* Row 1: Core IDE (Full Width Dominant) */}
                    <button
                        onClick={onNavigateCreator}
                        className="md:col-span-2 group relative p-10 bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-nexus-cyan/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_30px_rgba(14,165,233,0.1)] text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-96 h-96 bg-nexus-cyan/10 blur-[100px] -mr-32 -mt-32 pointer-events-none rounded-full" />
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                            <div className="max-w-xl space-y-6">
                                <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 border border-nexus-cyan/20 flex items-center justify-center group-hover:bg-nexus-cyan/20 transition-all">
                                    <Terminal className="w-8 h-8 text-nexus-cyan" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-white mb-3 tracking-tight italic">Core IDE</h2>
                                    <p className="text-slate-400 text-lg leading-relaxed">
                                        Secure workspace to write, compile, debug, and validate CashScript contracts with real consensus execution tracing.
                                    </p>
                                </div>
                                <div className="flex items-center text-nexus-cyan font-bold text-sm tracking-widest uppercase group-hover:gap-2 transition-all">
                                    Open Workspace <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                            {/* Decorative element for IDE card */}
                            <div className="hidden lg:block w-64 h-40 bg-slate-900/50 rounded-xl border border-white/5 opacity-50 relative">
                                <div className="absolute top-3 left-3 flex space-x-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-500/30" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500/30" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/30" />
                                </div>
                                <div className="mt-8 px-4 space-y-2">
                                    <div className="h-1.5 w-full bg-white/5 rounded" />
                                    <div className="h-1.5 w-3/4 bg-white/5 rounded" />
                                    <div className="h-1.5 w-1/2 bg-nexus-cyan/30 rounded" />
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Row 2: Wizard (Secondary) */}
                    <button
                        onClick={onNavigateWizard}
                        className="group relative p-8 bg-white/[0.02] backdrop-blur-lg border border-white/5 hover:border-nexus-purple/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_25px_rgba(139,92,246,0.1)] text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-nexus-purple/5 blur-3xl -mr-16 -mt-16 pointer-events-none rounded-full" />
                        <div className="w-14 h-14 rounded-xl bg-nexus-purple/10 border border-nexus-purple/20 flex items-center justify-center mb-6 group-hover:bg-nexus-purple/20 transition-all">
                            <Wand2 className="w-7 h-7 text-nexus-purple" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3 tracking-tight italic">Smart Wizard</h2>
                        <p className="text-slate-400 flex-1 mb-8 text-sm leading-relaxed">
                            Generate audited contract templates using deterministic parameter injection. No hallucinated logic. Reproducible by design.
                        </p>
                        <div className="text-nexus-purple font-bold text-sm tracking-widest uppercase flex items-center group-hover:gap-1 transition-all">
                            Launch Wizard <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>

                    {/* Row 2: Registry (Secondary) */}
                    <button
                        onClick={onNavigateRegistry}
                        className="group relative p-8 bg-white/[0.02] backdrop-blur-lg border border-white/5 hover:border-green-400/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] text-left overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-green-400/5 blur-3xl -mr-16 -mt-16 pointer-events-none rounded-full" />
                        <div className="w-14 h-14 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center mb-6 group-hover:bg-green-400/20 transition-all">
                            <Globe className="w-7 h-7 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3 tracking-tight italic">Verified Registry</h2>
                        <p className="text-slate-400 flex-1 mb-8 text-sm leading-relaxed">
                            Browse community contracts that passed the NexOps Audit Gate. Public, verifiable, and forkable for your own use cases.
                        </p>
                        <div className="text-green-400 font-bold text-sm tracking-widest uppercase flex items-center group-hover:gap-1 transition-all">
                            Explore Registry <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                    </button>
                </div>

                {/* Legacy Project List Section */}
                <div className="pt-20 border-t border-white/5">
                    <div className="flex items-center justify-between mb-12">
                        <div className="space-y-1 text-left">
                            <h3 className="text-3xl font-black text-white tracking-tight italic">Recent Activity</h3>
                            <p className="text-slate-500 text-sm">Continue working on your private contract drafts.</p>
                        </div>
                        <button
                            onClick={onNavigateCreator}
                            className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-nexus-cyan transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Project</span>
                        </button>
                    </div>

                    {projects.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                            <Folder className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">
                                No active projects in this workspace yet.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => onSelectProject(project.id)}
                                    className="group p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.05] hover:border-nexus-cyan/30 transition-all text-left"
                                >
                                    <div className="flex items-center space-x-4 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-white/5 flex items-center justify-center group-hover:bg-nexus-cyan/10 group-hover:border-nexus-cyan/20 transition-all">
                                            <Folder className="w-6 h-6 text-slate-400 group-hover:text-nexus-cyan" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="text-lg font-bold text-white truncate transition-colors">
                                                {project.name}
                                            </h3>
                                            <div className="flex items-center text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                                <Code2 className="w-3 h-3 mr-1" />
                                                {project.files.length} Modules
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex items-center text-[10px] text-slate-500 font-mono">
                                            <Clock className="w-3 h-3 mr-1 opacity-50" />
                                            {new Date(project.lastModified).toLocaleDateString()}
                                        </div>
                                        <div className="text-nexus-cyan opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

