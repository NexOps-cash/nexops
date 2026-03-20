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
    const [currentPage, setCurrentPage] = useState(0);
    const PROJECTS_PER_PAGE = 6;

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


                {/* 1. Your Workspaces (Primary for returning users) */}
                <div className="pt-10 pb-20">
                    <div className="flex items-center justify-between mb-12">
                        <div className="space-y-1 text-left">
                            <h3 className="text-3xl font-black text-white tracking-tight italic">
                                {projects.length > 0 ? 'Your Workspaces' : 'Recent Activity'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                                {projects.length > 0 ? 'Continue where you left off in the protocol.' : 'Start your first project or dive into the registry.'}
                            </p>
                        </div>
                        <button
                            onClick={onNavigateCreator}
                            className="flex items-center space-x-2 px-4 py-2 bg-nexus-cyan/10 hover:bg-nexus-cyan/20 border border-nexus-cyan/20 rounded-xl text-sm text-nexus-cyan transition-all font-bold"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Workspace</span>
                        </button>
                    </div>

                    {projects.length === 0 ? (
                        <div className="text-center py-20 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                            <Folder className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium max-w-xs mx-auto">
                                No active projects in this workspace yet. Start with the Core IDE or Smart Wizard below.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {projects
                                    .slice(currentPage * PROJECTS_PER_PAGE, (currentPage + 1) * PROJECTS_PER_PAGE)
                                    .map((project) => (
                                        <button
                                            key={project.id}
                                            onClick={() => onSelectProject(project.id)}
                                            className="group p-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl hover:bg-white/[0.05] hover:border-nexus-cyan/30 transition-all text-left relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-nexus-cyan/5 blur-2xl -mr-8 -mt-8 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
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

                            {/* Pagination Controls */}
                            {projects.length > PROJECTS_PER_PAGE && (
                                <div className="flex items-center justify-center space-x-4 mt-12 pb-10">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                        disabled={currentPage === 0}
                                        className={`px-4 py-2 rounded-lg border flex items-center space-x-2 transition-all ${currentPage === 0
                                                ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-nexus-cyan/40'
                                            }`}
                                    >
                                        <ArrowRight className="w-4 h-4 transform rotate-180" />
                                        <span className="text-xs font-bold uppercase tracking-widest">Previous</span>
                                    </button>

                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                                        Page {currentPage + 1} of {Math.ceil(projects.length / PROJECTS_PER_PAGE)}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(projects.length / PROJECTS_PER_PAGE) - 1, prev + 1))}
                                        disabled={(currentPage + 1) * PROJECTS_PER_PAGE >= projects.length}
                                        className={`px-4 py-2 rounded-lg border flex items-center space-x-2 transition-all ${(currentPage + 1) * PROJECTS_PER_PAGE >= projects.length
                                                ? 'bg-white/5 border-white/5 text-slate-600 cursor-not-allowed'
                                                : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-nexus-cyan/40'
                                            }`}
                                    >
                                        <span className="text-xs font-bold uppercase tracking-widest">Next</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 2. Exploration & Tools (Quick Start) */}
                <div className="border-t border-white/5 pt-20">
                    <div className="mb-12 text-left">
                        <h3 className="text-2xl font-black text-white/50 tracking-tight italic uppercase">Quick Start Tools</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                        {/* Row 1: Core IDE (Full Width Dominant) */}
                        <div
                            onClick={() => onNavigateCreator()}
                            className="md:col-span-2 group relative p-10 bg-blue-500/[0.03] backdrop-blur-2xl border border-blue-500/10 hover:border-nexus-cyan/40 rounded-3xl transition-all duration-500 transform hover:translate-y-[-2px] hover:shadow-[0_0_40px_rgba(14,165,233,0.15)] text-left overflow-hidden cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-96 h-96 bg-nexus-cyan/10 blur-[100px] -mr-32 -mt-32 pointer-events-none rounded-full" />
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.02] to-transparent pointer-events-none" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                                <div className="max-w-xl space-y-6">
                                    <div className="w-16 h-16 rounded-2xl bg-nexus-cyan/10 border border-nexus-cyan/20 flex items-center justify-center group-hover:bg-nexus-cyan/20 transition-all">
                                        <Terminal className="w-8 h-8 text-nexus-cyan" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-white mb-3 tracking-tight italic">Core IDE</h2>
                                        <p className="text-slate-400 text-lg leading-relaxed">
                                            Secure workspace to write, compile, debug, and validate CashScript contracts.
                                        </p>
                                    </div>
                                    <div className="flex items-center text-nexus-cyan font-bold text-sm tracking-widest uppercase group-hover:gap-2 transition-all">
                                        Open Workspace <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
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
                        </div>

                        {/* Row 2: Wizard */}
                        <div
                            onClick={onNavigateWizard}
                            className="group relative p-8 bg-blue-500/[0.02] backdrop-blur-xl border border-blue-500/5 hover:border-nexus-purple/40 rounded-3xl transition-all duration-500 transform hover:translate-y-[-2px] hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] text-left overflow-hidden cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-nexus-purple/5 blur-3xl -mr-16 -mt-16 pointer-events-none rounded-full" />
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.01] to-transparent pointer-events-none" />
                            <div className="w-14 h-14 rounded-xl bg-nexus-purple/10 border border-nexus-purple/20 flex items-center justify-center mb-6 group-hover:bg-nexus-purple/20 transition-all">
                                <Wand2 className="w-7 h-7 text-nexus-purple" />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-3 tracking-tight italic">Smart Wizard</h2>
                            <div className="text-nexus-purple font-bold text-sm tracking-widest uppercase flex items-center group-hover:gap-1 transition-all">
                                Launch Wizard <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>

                        {/* Row 2: Registry */}
                        <div
                            onClick={onNavigateRegistry}
                            className="group relative p-8 bg-blue-500/[0.02] backdrop-blur-xl border border-blue-500/5 hover:border-green-400/40 rounded-3xl transition-all duration-500 transform hover:translate-y-[-2px] hover:shadow-[0_0_30px_rgba(16,185,129,0.1)] text-left overflow-hidden cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 w-48 h-48 bg-green-400/5 blur-3xl -mr-16 -mt-16 pointer-events-none rounded-full" />
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.01] to-transparent pointer-events-none" />
                            <div className="w-14 h-14 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center mb-6 group-hover:bg-green-400/20 transition-all">
                                <Globe className="w-7 h-7 text-green-400" />
                            </div>
                            <h2 className="text-2xl font-black text-white mb-3 tracking-tight italic">Verified Registry</h2>
                            <div className="text-green-400 font-bold text-sm tracking-widest uppercase flex items-center group-hover:gap-1 transition-all">
                                Explore Registry <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>
                </div>



            </div>
        </div>
    );
};

