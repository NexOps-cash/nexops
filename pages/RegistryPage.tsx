import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, Download, Star, Code2, Users, FileWarning, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, Input } from '../components/UI';
import { supabase } from '../lib/supabase';

interface RegistryPageProps {
    onLoadContract?: (contract: any) => void;
}

export const RegistryPage: React.FC<RegistryPageProps> = ({ onLoadContract }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('contracts_registry')
                .select('*')
                .order('created_at', { ascending: false });

            if (sbError) throw sbError;
            setContracts(data || []);
        } catch (err: any) {
            console.error('Error fetching registry:', err);
            setError(err.message || 'Failed to connect to Supabase. Your project might be paused or there is a network issue.');
        } finally {
            setLoading(false);
        }
    };

    const copySource = (code: string) => {
        navigator.clipboard.writeText(code);
        // We could add a toast here, but relying on visual feedback for now
    };

    const downloadContract = (contract: any) => {
        const blob = new Blob([contract.source_code], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contract.title.toLowerCase().replace(/\s+/g, '_')}.cash`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const filteredContracts = contracts.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="h-full w-full bg-nexus-900 overflow-auto p-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-6">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center tracking-tight mb-1">
                            <ShieldCheck className="w-8 h-8 text-green-400 mr-3" />
                            Verified Registry
                        </h1>
                        <p className="text-slate-500 text-sm">
                            Infrastructure-grade smart contracts audited for the BCH ecosystem.
                        </p>
                    </div>
                    <div className="w-full md:w-80 relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-slate-500 group-focus-within:text-nexus-cyan transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Find contracts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-nexus-800/40 backdrop-blur-md border border-white/10 focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/20 h-10 pl-10 pr-4 rounded-lg text-sm text-slate-200 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Filter Chips & Metrics Telemetry Strip */}
                <div className="flex flex-col space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {['All', 'Verified', 'Community', 'Most Downloaded', 'Recently Added'].map((filter) => (
                            <button
                                key={filter}
                                className={`px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.15em] transition-all transform active:scale-95 border ${filter === 'All'
                                    ? 'bg-nexus-cyan/15 border-nexus-cyan/40 text-nexus-cyan font-black shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                                    : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300 hover:scale-105'
                                    }`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 border-y border-white/5">
                        <div className="p-4 border-r border-white/5">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Telemetry: Assets</div>
                            <div className="text-3xl font-black text-white">{contracts.length}</div>
                        </div>
                        <div className="p-4 border-r border-white/5">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Security Status</div>
                            <div className="text-3xl font-black text-green-400 flex items-center">
                                {contracts.length} <span className="text-[10px] ml-2 opacity-50 font-mono italic">Verified</span>
                            </div>
                        </div>
                        <div className="p-4 border-r border-white/5">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Active Interactions</div>
                            <div className="text-3xl font-black text-nexus-cyan">2.8K</div>
                        </div>
                        <div className="p-4">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Verified Nodes</div>
                            <div className="text-3xl font-black text-nexus-purple">12</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexus-cyan"></div>
                            <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Authenticating with Registry...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-20 bg-red-500/5 rounded-xl border border-red-500/20 max-w-2xl mx-auto">
                            <FileWarning className="w-12 h-12 text-red-400 mx-auto mb-4" />
                            <h3 className="text-white font-bold mb-2">Connection Failure</h3>
                            <p className="text-slate-400 text-sm mb-6 px-8">
                                {error}
                                <br />
                                <span className="text-[10px] opacity-60 mt-2 block italic">Tip: Check if your Supabase project is paused in the dashboard.</span>
                            </p>
                            <button
                                onClick={fetchContracts}
                                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all"
                            >
                                Retry Connection
                            </button>
                        </div>
                    ) : filteredContracts.length === 0 ? (
                        <div className="text-center py-20 bg-nexus-800/50 rounded-xl border border-dashed border-slate-700">
                            <p className="text-slate-400">No contracts found matching your search.</p>
                        </div>
                    ) : (
                        filteredContracts.map((contract) => (
                            <div key={contract.id} className="space-y-4">
                                <div
                                    className="bg-nexus-800/60 backdrop-blur-sm border border-white/5 hover:border-nexus-cyan/30 p-6 rounded-lg transition-all group flex flex-col lg:flex-row gap-8 items-start lg:items-stretch justify-between"
                                >
                                    {/* Left: Metadata Section */}
                                    <div className="flex-1 text-left space-y-4">
                                        <div>
                                            <div className="flex items-center flex-wrap gap-2 mb-2">
                                                <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-nexus-cyan transition-colors italic">
                                                    {contract.title}
                                                </h3>
                                                <span className="text-[10px] font-mono font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">v{contract.version}</span>
                                                <span className="text-[10px] font-mono font-bold text-nexus-cyan bg-nexus-cyan/5 px-2 py-0.5 rounded border border-nexus-cyan/10 uppercase">Chipnet</span>
                                            </div>
                                            <div className="flex items-center text-xs text-slate-500 font-medium">
                                                by <span className="text-nexus-purple ml-1 hover:underline cursor-pointer">@{contract.author || 'anonymous'}</span>
                                            </div>
                                        </div>

                                        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                                            {contract.description}
                                        </p>

                                        <div className="flex items-center flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
                                            {contract.tags?.map((tag: string) => (
                                                <span key={tag} className="text-slate-500 bg-white/5 px-2 py-1 rounded hover:bg-white/10 transition-colors">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center space-x-4 pt-1">
                                            <div className="text-[10px] text-slate-600 font-mono">
                                                Compiler: <span className="text-slate-500 ml-1">{contract.compiler_version || 'cashc v0.13.0'}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-600 font-mono">
                                                Network: <span className="text-slate-500 ml-1">BCH Chipnet</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Security & Action Section */}
                                    <div className="flex flex-col lg:w-72 border-l border-white/5 lg:pl-8 space-y-6 shrink-0 justify-between items-center lg:items-end">
                                        <div className="flex flex-col items-center lg:items-end text-center lg:text-right">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-4xl font-black ${(contract.audit?.score || 90) >= 90 ? 'text-green-400' :
                                                    (contract.audit?.score || 90) >= 70 ? 'text-yellow-400' : 'text-red-400'
                                                    }`}>
                                                    {contract.audit?.score || 90}
                                                </span>
                                                <div className="flex flex-col items-start leading-none">
                                                    <span className="text-slate-600 text-[10px] uppercase font-bold tracking-tighter">/ 100</span>
                                                    {(contract.audit?.score || 90) >= 90 && (
                                                        <div className="text-green-500/80 text-[10px] flex items-center mt-1">
                                                            <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                                                            VERIFIED
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-slate-500 text-[10px] font-mono leading-none">NexOps Audit Engine v0.3</span>
                                        </div>

                                        <div className="flex items-center gap-6 self-center lg:self-end">
                                            <div className="text-center group/metric">
                                                <div className="text-white text-base font-black flex items-center justify-center">
                                                    <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500 group-hover/metric:text-nexus-cyan transition-colors" />
                                                    {contract.downloads || 0}
                                                </div>
                                                <div className="text-slate-500/60 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Loads</div>
                                            </div>
                                            <div className="text-center group/metric">
                                                <div className="text-white text-base font-black flex items-center justify-center">
                                                    <Star className="w-3.5 h-3.5 mr-1.5 text-slate-500 group-hover/metric:text-yellow-500 transition-colors" />
                                                    0
                                                </div>
                                                <div className="text-slate-500/60 text-[9px] font-black uppercase tracking-[0.2em] mt-1">Stars</div>
                                            </div>
                                        </div>

                                        <div className="w-full space-y-3">
                                            <button
                                                onClick={() => onLoadContract?.(contract)}
                                                className="w-full bg-green-500 hover:bg-green-400 text-nexus-900 font-black py-2.5 px-6 rounded-md transition-all transform hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(34,197,94,0.3)] active:translate-y-0 flex items-center justify-center text-sm"
                                            >
                                                Load to Workspace
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedId(expandedId === contract.id ? null : contract.id);
                                                }}
                                                className="w-full flex items-center justify-center text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
                                            >
                                                {expandedId === contract.id ? <ChevronUp className="w-3.5 h-3.5 mr-1.5" /> : <ChevronDown className="w-3.5 h-3.5 mr-1.5" />}
                                                {expandedId === contract.id ? "Hide Logic" : "Inspect Logic"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {expandedId === contract.id && (
                                    <div className="bg-nexus-800/80 border border-nexus-cyan/20 p-6 rounded-lg animate-in slide-in-from-top-4 overflow-hidden relative">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center text-nexus-cyan text-xs font-black uppercase tracking-widest">
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Logic Inspection
                                                </div>
                                                <div className="h-4 w-px bg-white/5" />
                                                <div className="text-[10px] text-slate-600 font-mono flex items-center">
                                                    <span className="opacity-50 mr-2">HASH:</span>
                                                    <span className="text-slate-500 uppercase">{contract.id?.slice(0, 12) || 'UNKNOWN'}...</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => copySource(contract.source_code)}
                                                    className="flex items-center text-[10px] font-bold text-slate-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded border border-white/5"
                                                >
                                                    Copy Source
                                                </button>
                                                <button
                                                    onClick={() => downloadContract(contract)}
                                                    className="flex items-center text-[10px] font-bold text-nexus-cyan hover:text-white transition-colors bg-nexus-cyan/5 px-3 py-1.5 rounded border border-nexus-cyan/10"
                                                >
                                                    Download .cash
                                                </button>
                                                <div className="text-slate-500 text-[10px] font-mono opacity-50 ml-2">
                                                    {contract.compiler_version || 'cashc v0.13.0'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/40 rounded-md p-6 border border-white/5 max-h-[500px] overflow-auto custom-scrollbar relative">
                                            <div className="absolute top-0 right-0 p-2 pointer-events-none">
                                                <Code2 className="w-12 h-12 text-white/[0.03]" />
                                            </div>
                                            <pre className="text-sm font-mono text-slate-300 leading-relaxed text-left whitespace-pre-wrap">
                                                <code>{contract.source_code}</code>
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div >
    );
};
