import React, { useMemo, useState, useEffect } from 'react';
import { Project } from '../types';
import {
    Folder, Plus, Clock, Terminal, Wand2, Globe,
    ArrowRight, History, ChevronDown
} from 'lucide-react';

const RECENT_INITIAL = 3;
const RECENT_PAGE = 5;
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

/** Relative time for screen readers and compact UI */
function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString();
}

export const LandingPage: React.FC<LandingPageProps> = ({
    projects = [],
    onSelectProject,
    onNavigateCreator,
    onNavigateWizard,
    onNavigateRegistry
}) => {
    const sortedProjects = useMemo(() => {
        return [...(projects ?? [])].sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
    }, [projects]);

    /** Prefer last-opened id from storage so “continue” matches user expectation */
    const lastOpenedId = useMemo(() => {
        try {
            return localStorage.getItem('nexops_last_project_id');
        } catch {
            return null;
        }
    }, []);

    const orderedForRecent = useMemo(() => {
        if (!lastOpenedId) return sortedProjects;
        const idx = sortedProjects.findIndex(p => p.id === lastOpenedId);
        if (idx <= 0) return sortedProjects;
        const copy = [...sortedProjects];
        const [hit] = copy.splice(idx, 1);
        return [hit, ...copy];
    }, [sortedProjects, lastOpenedId]);

    const totalRecent = orderedForRecent.length;
    const [recentVisible, setRecentVisible] = useState(RECENT_INITIAL);

    useEffect(() => {
        setRecentVisible(RECENT_INITIAL);
    }, [projects.length, sortedProjects.length]);

    const visibleRecent = useMemo(
        () => orderedForRecent.slice(0, recentVisible),
        [orderedForRecent, recentVisible]
    );
    const hasMoreRecent = recentVisible < totalRecent;
    const nextChunk = hasMoreRecent ? Math.min(RECENT_PAGE, totalRecent - recentVisible) : 0;

    return (
        <div className="h-full w-full bg-nexus-900 overflow-auto relative">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 opacity-25 pointer-events-none overflow-hidden">
                <Hyperspeed effectOptions={HYPERSPEED_OPTIONS} />
            </div>
            <div className="absolute inset-0 grid-overlay opacity-10 pointer-events-none" />

            <div className="max-w-6xl w-full mx-auto p-6 sm:p-12 space-y-16 sm:space-y-24 relative z-10">

                {/* Recent workspaces — Cursor-style: first actionable region, keyboard + touch friendly */}
                <section
                    className="pt-6 sm:pt-10"
                    aria-labelledby="recent-workspaces-heading"
                >
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
                        <div className="space-y-1 text-left">
                            <h2
                                id="recent-workspaces-heading"
                                className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2"
                            >
                                <History className="w-5 h-5 text-nexus-cyan shrink-0" aria-hidden />
                                Recent workspaces
                            </h2>
                            <p id="recent-workspaces-desc" className="text-slate-500 text-sm max-w-xl">
                                Open a project to continue where you left off. Same order as Cursor: recents first, one tap or Enter to open.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {orderedForRecent.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onSelectProject(orderedForRecent[0].id)}
                                    className="min-h-[44px] px-4 py-2 rounded-xl bg-nexus-cyan/15 hover:bg-nexus-cyan/25 border border-nexus-cyan/30 text-nexus-cyan text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-nexus-900 transition-colors"
                                    aria-label={`Continue with most recent workspace, ${orderedForRecent[0].name?.trim() || 'Untitled project'}`}
                                >
                                    Continue last
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onNavigateCreator}
                                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-nexus-900 transition-colors"
                            >
                                <Plus className="w-4 h-4 shrink-0" aria-hidden />
                                New project
                            </button>
                        </div>
                    </div>

                    {orderedForRecent.length === 0 ? (
                        <div
                            className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center"
                            role="status"
                            aria-live="polite"
                        >
                            <Folder className="w-12 h-12 text-slate-600 mx-auto mb-3" aria-hidden />
                            <p className="text-slate-400 font-medium">No workspaces yet.</p>
                            <p className="text-slate-500 text-sm mt-1">Create a project below or open the Core IDE.</p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                        <p className="sr-only" aria-live="polite">
                            Showing {visibleRecent.length} of {totalRecent} workspaces
                        </p>
                        <ul
                            role="list"
                            className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/5 overflow-hidden"
                            aria-describedby="recent-workspaces-desc"
                        >
                            {visibleRecent.map((project) => {
                                const fileCount = (project.files ?? []).length;
                                const modified = project.lastModified ?? 0;
                                const rel = formatRelativeTime(modified);
                                const abs = new Date(modified).toLocaleString();
                                const displayName = project.name?.trim() || 'Untitled project';
                                const chainLabel =
                                    typeof project.chain === 'string'
                                        ? project.chain.split(' ')[0]
                                        : 'BCH';
                                return (
                                    <li key={project.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectProject(project.id)}
                                            className="w-full min-h-[48px] flex items-center gap-4 px-4 py-3 sm:px-5 text-left hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nexus-cyan"
                                            aria-label={`Open workspace ${displayName}, last edited ${abs}`}
                                        >
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 border border-white/10">
                                                <Folder className="w-5 h-5 text-nexus-cyan" aria-hidden />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-semibold text-white truncate">
                                                    {displayName}
                                                </span>
                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                    {chainLabel} · {fileCount} file{fileCount === 1 ? '' : 's'}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs text-slate-500 tabular-nums" title={abs}>
                                                <Clock className="w-3.5 h-3.5 inline mr-1 opacity-60 align-text-bottom" aria-hidden />
                                                {rel}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        {hasMoreRecent && (
                            <div className="mt-3 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setRecentVisible((n) =>
                                            Math.min(n + RECENT_PAGE, totalRecent)
                                        )
                                    }
                                    className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-slate-300 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-nexus-900 transition-colors"
                                    aria-label={`Show ${nextChunk} more workspaces, ${totalRecent - recentVisible} hidden`}
                                >
                                    <ChevronDown className="w-4 h-4 text-nexus-cyan shrink-0" aria-hidden />
                                    Show {nextChunk} more
                                    <span className="text-slate-500 font-normal">
                                        ({totalRecent - recentVisible} left)
                                    </span>
                                </button>
                            </div>
                        )}
                        </div>
                    )}
                </section>

                {/* Core paths */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">

                    {/* Row 1: Core IDE (Full Width Dominant) */}
                    <div
                        onClick={() => onNavigateCreator()}
                        className="md:col-span-2 group relative p-10 bg-white/[0.03] backdrop-blur-xl border border-white/10 hover:border-nexus-cyan/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_30px_rgba(14,165,233,0.1)] text-left overflow-hidden cursor-pointer"
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
                    </div>

                    {/* Row 2: Wizard (Secondary) */}
                    <div
                        onClick={onNavigateWizard}
                        className="group relative p-8 bg-white/[0.02] backdrop-blur-lg border border-white/5 hover:border-nexus-purple/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_25px_rgba(139,92,246,0.1)] text-left overflow-hidden cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-nexus-purple/5 blur-3xl -mr-16 -mt-16 pointer-events-none rounded-full" />
                        <div className="w-14 h-14 rounded-xl bg-nexus-purple/10 border border-nexus-purple/20 flex items-center justify-center mb-6 group-hover:bg-nexus-purple/20 transition-all">
                            <Wand2 className="w-7 h-7 text-nexus-purple" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3 tracking-tight italic">Smart Wizard (Beta)</h2>
                        <p className="text-slate-400 flex-1 mb-8 text-sm leading-relaxed">
                            Generate audited contract templates using deterministic parameter injection. No hallucinated logic. Reproducible by design.
                        </p>
                        <div className="text-nexus-purple font-bold text-sm tracking-widest uppercase flex items-center group-hover:gap-1 transition-all">
                            Launch Wizard (Beta) <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>

                    {/* Row 2: Registry (Secondary) */}
                    <div
                        onClick={onNavigateRegistry}
                        className="group relative p-8 bg-white/[0.02] backdrop-blur-lg border border-white/5 hover:border-green-400/40 rounded-3xl transition-all duration-300 transform hover:translate-y-[-2px] hover:shadow-[0_0_25px_rgba(16,185,129,0.1)] text-left overflow-hidden cursor-pointer"
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
                    </div>
                </div>

            </div>
        </div>
    );
};

