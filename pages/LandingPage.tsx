import React, { useMemo, useState, useEffect } from 'react';
import { Project } from '../types';
import {
    Folder, Plus, Clock, Terminal, Wand2, Globe,
    ArrowRight, History, ChevronDown
} from 'lucide-react';

const RECENT_INITIAL = 3;
const RECENT_PAGE = 5;

interface LandingPageProps {
    projects: Project[];
    onSelectProject: (projectId: string) => void;
    onNavigateCreator: () => void;
    onNavigateWizard: () => void;
    onNavigateRegistry: () => void;
}

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
        <div className="relative min-h-full w-full text-slate-300 bg-[#050a08]">
            {/* Full-scroll atmosphere: top + mid + bottom so the page never falls to flat black */}
            <div className="pointer-events-none absolute inset-0 min-h-full z-0" aria-hidden>
                <div className="absolute inset-0 min-h-full bg-gradient-to-b from-[#041208] via-[#0a1612] via-[#0c1814] to-[#081210]" />
                <div className="absolute inset-0 min-h-full bg-[radial-gradient(ellipse_130%_55%_at_50%_-25%,rgba(16,185,129,0.18),transparent_58%)]" />
                <div className="absolute inset-0 min-h-full bg-[radial-gradient(ellipse_90%_70%_at_50%_45%,rgba(6,95,70,0.22),transparent_65%)]" />
                <div className="absolute inset-0 min-h-full bg-[radial-gradient(ellipse_100%_50%_at_50%_110%,rgba(5,150,105,0.14),transparent_55%)]" />
                <div className="absolute inset-0 min-h-full bg-[radial-gradient(ellipse_60%_40%_at_0%_30%,rgba(52,211,153,0.06),transparent_50%)]" />
                <div className="absolute inset-0 min-h-full bg-[radial-gradient(ellipse_55%_35%_at_100%_70%,rgba(16,185,129,0.07),transparent_48%)]" />
                <div
                    className="absolute inset-0 min-h-full opacity-[0.4]
                        bg-[linear-gradient(rgba(167,243,208,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(167,243,208,0.035)_1px,transparent_1px)]
                        [background-size:40px_40px]"
                />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-900/40 to-transparent" />
            </div>

            <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 lg:px-10 py-8 sm:py-10 space-y-12 sm:space-y-14 relative z-10 pb-20">

                {/* Recent workspaces — Cursor-style: first actionable region, keyboard + touch friendly */}
                <section
                    className="pt-2 sm:pt-4"
                    aria-labelledby="recent-workspaces-heading"
                >
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
                        <div className="space-y-2 text-left">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">
                                Continue
                            </p>
                            <h2
                                id="recent-workspaces-heading"
                                className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3"
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25 shadow-inner shadow-emerald-900/20">
                                    <History className="w-5 h-5 text-emerald-400" aria-hidden />
                                </span>
                                Recent workspaces
                            </h2>
                            <p id="recent-workspaces-desc" className="text-slate-400 text-sm max-w-lg leading-relaxed">
                                Pick up where you left off — open a project below.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {orderedForRecent.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onSelectProject(orderedForRecent[0].id)}
                                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg shadow-emerald-950/50 hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a08] transition-colors"
                                    aria-label={`Continue with most recent workspace, ${orderedForRecent[0].name?.trim() || 'Untitled project'}`}
                                >
                                    Continue last
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onNavigateCreator}
                                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/12 text-sm text-slate-200 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a08] transition-colors"
                            >
                                <Plus className="w-4 h-4 shrink-0" aria-hidden />
                                New project
                            </button>
                        </div>
                    </div>

                    {orderedForRecent.length === 0 ? (
                        <div
                            className="rounded-2xl border border-emerald-500/15 bg-emerald-950/20 px-4 py-12 text-center shadow-xl shadow-black/30 ring-1 ring-white/5"
                            role="status"
                            aria-live="polite"
                        >
                            <Folder className="w-12 h-12 text-emerald-700/80 mx-auto mb-3" aria-hidden />
                            <p className="text-slate-300 font-medium">No workspaces yet.</p>
                            <p className="text-slate-500 text-sm mt-1">Create a project or open the Core IDE below.</p>
                        </div>
                    ) : (
                        <div className="space-y-0">
                        <p className="sr-only" aria-live="polite">
                            Showing {visibleRecent.length} of {totalRecent} workspaces
                        </p>
                        <div className="rounded-2xl border border-emerald-500/20 bg-[#0c1410]/90 backdrop-blur-sm shadow-2xl shadow-black/40 ring-1 ring-white/[0.06] overflow-hidden">
                        <div className="h-1 bg-gradient-to-r from-emerald-600/50 via-emerald-400/40 to-emerald-600/50" aria-hidden />
                        <ul
                            role="list"
                            className="divide-y divide-emerald-950/50"
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
                                            className="w-full min-h-[52px] flex items-center gap-4 px-4 py-3.5 sm:px-5 text-left hover:bg-emerald-950/40 active:bg-emerald-950/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50"
                                            aria-label={`Open workspace ${displayName}, last edited ${abs}`}
                                        >
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-950/80 border border-emerald-500/20 shadow-inner">
                                                <Folder className="w-5 h-5 text-emerald-400/90" aria-hidden />
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block font-semibold text-white truncate">
                                                    {displayName}
                                                </span>
                                                <span className="block text-xs text-slate-400 mt-0.5">
                                                    {chainLabel} · {fileCount} file{fileCount === 1 ? '' : 's'}
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-xs text-slate-400 tabular-nums" title={abs}>
                                                <Clock className="w-3.5 h-3.5 inline mr-1 opacity-70 align-text-bottom" aria-hidden />
                                                {rel}
                                            </span>
                                            <ArrowRight className="w-4 h-4 text-emerald-600/70 shrink-0" aria-hidden />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        </div>
                        {hasMoreRecent && (
                            <div className="mt-3 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setRecentVisible((n) =>
                                            Math.min(n + RECENT_PAGE, totalRecent)
                                        )
                                    }
                                    className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-xl border border-emerald-500/25 bg-emerald-950/30 hover:bg-emerald-950/50 text-sm font-medium text-emerald-100/90 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a08] transition-colors"
                                    aria-label={`Show ${nextChunk} more workspaces, ${totalRecent - recentVisible} hidden`}
                                >
                                    <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-6">
                    <p className="md:col-span-2 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60 -mb-2">
                        Tools
                    </p>

                    {/* Core IDE — primary */}
                    <div
                        onClick={() => onNavigateCreator()}
                        className="md:col-span-2 group relative p-8 sm:p-10 rounded-2xl border border-emerald-500/25 bg-[#0c1410]/95 shadow-2xl shadow-black/50 ring-1 ring-white/[0.05] hover:border-emerald-400/40 hover:shadow-emerald-950/30 text-left overflow-hidden cursor-pointer transition-all duration-300"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent pointer-events-none" />
                        <div className="absolute top-0 right-0 w-[28rem] h-[28rem] bg-emerald-500/10 blur-[120px] -mr-24 -mt-24 pointer-events-none rounded-full" />
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                            <div className="max-w-xl space-y-5">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center shadow-inner">
                                    <Terminal className="w-7 h-7 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Core IDE</h2>
                                    <p className="text-slate-400 text-base leading-relaxed">
                                        Write, compile, debug, and validate CashScript with execution tracing.
                                    </p>
                                </div>
                                <div className="flex items-center text-emerald-400 font-semibold text-sm tracking-wide group-hover:gap-2 transition-all">
                                    Open workspace <ArrowRight className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                            <div className="hidden lg:block w-64 h-40 rounded-xl border border-emerald-500/15 bg-emerald-950/40 shadow-inner relative overflow-hidden">
                                <div className="absolute top-3 left-3 flex space-x-1.5">
                                    <div className="w-2 h-2 rounded-full bg-red-400/40" />
                                    <div className="w-2 h-2 rounded-full bg-amber-400/40" />
                                    <div className="w-2 h-2 rounded-full bg-emerald-400/50" />
                                </div>
                                <div className="mt-10 px-4 space-y-2">
                                    <div className="h-1.5 w-full bg-white/10 rounded" />
                                    <div className="h-1.5 w-3/4 bg-white/[0.08] rounded" />
                                    <div className="h-1.5 w-1/2 bg-emerald-500/40 rounded" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        onClick={onNavigateWizard}
                        className="group relative p-7 rounded-2xl border border-violet-500/20 bg-[#0c1218]/90 shadow-xl shadow-black/40 ring-1 ring-white/[0.04] hover:border-violet-400/35 text-left overflow-hidden cursor-pointer transition-all duration-300"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 blur-3xl -mr-12 -mt-12 pointer-events-none rounded-full" />
                        <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-400/25 flex items-center justify-center mb-5">
                            <Wand2 className="w-6 h-6 text-violet-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Smart Wizard (Beta)</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Audited templates with deterministic parameters — reproducible by design.
                        </p>
                        <div className="text-violet-400 font-semibold text-sm flex items-center group-hover:gap-1 transition-all">
                            Launch wizard <ArrowRight className="ml-2 w-4 h-4" />
                        </div>
                    </div>

                    <div
                        onClick={onNavigateRegistry}
                        className="group relative p-7 rounded-2xl border border-emerald-500/25 bg-[#0a1410]/90 shadow-xl shadow-black/40 ring-1 ring-white/[0.04] hover:border-emerald-400/40 text-left overflow-hidden cursor-pointer transition-all duration-300"
                    >
                        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl -mr-12 -mt-12 pointer-events-none rounded-full" />
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mb-5">
                            <Globe className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Verified Registry</h2>
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                            Community contracts that passed the NexOps audit gate — fork and verify.
                        </p>
                        <div className="text-emerald-400 font-semibold text-sm flex items-center group-hover:gap-1 transition-all">
                            Explore registry <ArrowRight className="ml-2 w-4 h-4" />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

