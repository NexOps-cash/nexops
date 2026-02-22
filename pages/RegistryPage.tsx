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
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchContracts();
    }, []);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('contracts_registry')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContracts(data || []);
        } catch (error) {
            console.error('Error fetching registry:', error);
        } finally {
            setLoading(false);
        }
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
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800 pb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white flex items-center tracking-tight mb-2">
                            <ShieldCheck className="w-10 h-10 text-green-400 mr-4" />
                            Verified Registry
                        </h1>
                        <p className="text-slate-400 text-lg">
                            Discover and reuse smart contracts from the secure NexOps Registry. All code is automatically audited for safety.
                        </p>
                    </div>
                    <div className="w-full md:w-96">
                        <Input
                            placeholder="Search contracts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-nexus-800 border-slate-700 h-12"
                            icon={<Search className="w-5 h-5 text-slate-400" />}
                        />
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className="bg-nexus-800/50 p-4 border border-slate-700/50">
                        <div className="flex items-center text-slate-400 text-sm mb-2"><Code2 className="w-4 h-4 mr-2" /> Total Contracts</div>
                        <div className="text-2xl font-bold text-white">{contracts.length}</div>
                    </Card>
                    <Card className="bg-nexus-800/50 p-4 border border-slate-700/50">
                        <div className="flex items-center text-green-400 text-sm mb-2"><ShieldCheck className="w-4 h-4 mr-2" /> Verified</div>
                        <div className="text-2xl font-bold text-white">{contracts.length}</div>
                    </Card>
                    <Card className="bg-nexus-800/50 p-4 border border-slate-700/50">
                        <div className="flex items-center text-nexus-cyan text-sm mb-2"><Download className="w-4 h-4 mr-2" /> Downloads</div>
                        <div className="text-2xl font-bold text-white">12.5k</div>
                    </Card>
                    <Card className="bg-nexus-800/50 p-4 border border-slate-700/50">
                        <div className="flex items-center text-nexus-purple text-sm mb-2"><Users className="w-4 h-4 mr-2" /> Authors</div>
                        <div className="text-2xl font-bold text-white">45</div>
                    </Card>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nexus-cyan"></div>
                            <p>Loading Registry...</p>
                        </div>
                    ) : filteredContracts.length === 0 ? (
                        <div className="text-center py-20 bg-nexus-800/50 rounded-xl border border-dashed border-slate-700">
                            <p className="text-slate-400">No contracts found matching your search.</p>
                        </div>
                    ) : (
                        filteredContracts.map((contract) => (
                            <div key={contract.id} className="space-y-4">
                                <div
                                    className="bg-nexus-800 border-2 border-slate-700 hover:border-nexus-cyan/50 p-6 rounded-xl transition-all group flex flex-col md:flex-row gap-6 items-start md:items-center justify-between"
                                >
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center space-x-3 mb-2">
                                            <h3 className="text-xl font-bold text-white group-hover:text-nexus-cyan transition-colors">
                                                {contract.title}
                                            </h3>
                                            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">v{contract.version}</span>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-4">
                                            {contract.description}
                                        </p>
                                        <div className="flex items-center space-x-2 text-xs">
                                            {contract.tags?.map((tag: string) => (
                                                <span key={tag} className="text-nexus-purple bg-nexus-purple/10 border border-nexus-purple/20 px-2 py-1 rounded-full">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end space-y-4 shrink-0">
                                        <div className="flex items-center space-x-4 text-sm">
                                            <div className="flex flex-col items-end">
                                                <span className="text-slate-500 text-xs">Audit Score</span>
                                                <span className="font-black text-lg text-green-400">
                                                    {contract.audit?.score || 90}/100
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-slate-500 text-xs">Downloads</span>
                                                <span className="font-bold text-white flex items-center">
                                                    <Download className="w-4 h-4 mr-1 text-slate-400" />
                                                    {contract.downloads || 0}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2 w-full">
                                            <button
                                                onClick={() => onLoadContract?.(contract)}
                                                className="bg-slate-700 hover:bg-nexus-cyan hover:text-nexus-900 text-white font-bold py-2 px-6 rounded transition-colors w-full md:w-auto"
                                            >
                                                Load to Workspace
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedId(expandedId === contract.id ? null : contract.id);
                                                }}
                                                className="flex items-center text-slate-400 hover:text-white text-xs transition-colors"
                                            >
                                                {expandedId === contract.id ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                                                {expandedId === contract.id ? "Hide Source" : "View Source"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {expandedId === contract.id && (
                                    <div className="bg-nexus-800 border-2 border-nexus-cyan/30 p-6 rounded-xl animate-in slide-in-from-top-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center text-nexus-cyan text-sm font-bold">
                                                <Eye className="w-4 h-4 mr-2" />
                                                Source Code Inspection
                                            </div>
                                            <div className="text-slate-500 text-xs font-mono">
                                                {contract.compiler_version || 'cashc v0.9.0'}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900/80 rounded-lg p-6 border border-slate-700 max-h-[500px] overflow-auto custom-scrollbar">
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
