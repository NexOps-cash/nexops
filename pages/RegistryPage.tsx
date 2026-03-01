import React, { useState, useEffect } from 'react';
import { Search, ShieldCheck, Download, Star, Code2, User, FileWarning, Eye, ChevronDown, ChevronUp, Github, Tag, Calendar, Layers, X, Copy, Check, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface RegistryPageProps {
    onLoadContract?: (contract: any) => void;
}

export const RegistryPage: React.FC<RegistryPageProps> = ({ onLoadContract }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [contracts, setContracts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedContract, setSelectedContract] = useState<any | null>(null);
    const [copied, setCopied] = useState(false);

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
            setError(err.message || 'Failed to connect to Supabase.');
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        'Vault', 'Savings', 'Timelock', 'Escrow', 'Multi-sig', 'Trade',
        'Crowdfunding', 'Assurance', 'DeFi', 'Payments', 'Covenants'
    ];

    const filteredContracts = contracts.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadContract = (contract: any) => {
        const code = contract.source_code || contract.code;
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${contract.title.toLowerCase().replace(/\s+/g, '-')}.cash`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full bg-bch-dark selection:bg-bch-green/30 text-white overflow-y-auto">
            <main className="max-w-7xl mx-auto px-6 py-12 md:py-24">
                {/* Hero Section */}
                <div className="mb-16 text-center md:text-left transition-all duration-700 animate-in fade-in slide-in-from-bottom-8">
                    <h2 className="text-5xl md:text-7xl font-display font-bold mb-8 leading-tight tracking-tight">
                        The era of <span className="text-bch-green">Programmable</span> Cash.
                    </h2>
                    <p className="text-xl text-white/60 max-w-2xl mb-12 font-medium leading-relaxed">
                        Explore, verify, and deploy secure smart contracts on the Bitcoin Cash network.
                        Built for developers, by developers.
                    </p>

                    {/* Search & Filters */}
                    <div className="space-y-8">
                        <div className="relative max-w-2xl group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-bch-green transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search contracts by name or description..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:border-bch-green/30 focus:ring-1 focus:ring-bch-green/20 transition-all placeholder:text-white/20 text-lg md:text-xl"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {categories.map(tag => (
                                <button
                                    key={tag}
                                    className="px-5 py-2 rounded-full text-xs font-bold border bg-white/5 text-white/80 border-white/10 hover:border-bch-green/30 hover:text-white transition-all flex items-center gap-2 group/tag"
                                >
                                    <Tag size={12} className="text-white/40 group-hover/tag:text-bch-green transition-colors" />
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="py-24 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bch-green"></div>
                    </div>
                ) : filteredContracts.length === 0 ? (
                    <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <p className="text-white/20 font-medium">No contracts found matching your criteria.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredContracts.map((contract, index) => (
                            <div
                                key={contract.id}
                                onClick={() => setSelectedContract(contract)}
                                className="group relative bg-white/5 glass-panel rounded-[32px] p-8 cursor-pointer hover:bg-white/10 transition-all border border-white/5 hover:border-bch-green/30 hover:-translate-y-1 duration-300"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="p-4 rounded-2xl bg-bch-green/10 text-bch-green group-hover:bg-bch-green group-hover:text-bch-dark transition-all duration-300 transform group-hover:scale-110">
                                        <Code2 size={28} />
                                    </div>
                                    <div className="flex gap-2">
                                        {contract.tags?.slice(0, 2).map((t: string) => (
                                            <span key={t} className="text-[10px] uppercase tracking-widest font-black text-white group-hover:text-bch-green/60 transition-colors">
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <h3 className="text-2xl font-display font-bold mb-3 group-hover:text-bch-green transition-colors tracking-tight">
                                    {contract.title}
                                </h3>
                                <p className="text-white/40 text-sm line-clamp-2 mb-8 leading-relaxed font-medium">
                                    {contract.description}
                                </p>

                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-white/20 group-hover:text-white/40 transition-colors">
                                        <User size={14} />
                                        <span>{contract.author || 'Satoshi_Fan'}</span>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-bch-green/50 group-hover:text-bch-green transition-colors">
                                        v{contract.version}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {selectedContract && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                    <div
                        onClick={() => setSelectedContract(null)}
                        className="absolute inset-0 bg-bch-dark/80 backdrop-blur-2xl"
                    />

                    <div className="relative w-full max-w-7xl h-full max-h-[85vh] bg-bch-surface border border-white/10 rounded-[40px] overflow-hidden flex flex-col md:flex-row shadow-2xl scale-in-center text-left">
                        {/* Left Side: Metadata (40%) */}
                        <div className="w-full md:w-[40%] flex-shrink-0 p-10 md:p-14 overflow-y-auto border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between">
                            <div className="space-y-10">
                                <button
                                    onClick={() => setSelectedContract(null)}
                                    className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all transform hover:rotate-90 duration-300 active:scale-90"
                                >
                                    <X size={24} />
                                </button>

                                <div className="space-y-10">
                                    <div className="space-y-8">
                                        <div>
                                            <div className="flex items-center gap-3 text-bch-green mb-3">
                                                <ShieldCheck size={20} />
                                                <span className="text-[11px] uppercase tracking-[0.3em] font-black">Verified Contract</span>
                                            </div>
                                            <h2 className="text-5xl font-display font-bold mb-6 leading-tight tracking-tight">{selectedContract.title}</h2>
                                            <p className="text-lg text-white/60 leading-relaxed font-medium">{selectedContract.description}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8">
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase tracking-[0.2em] text-bch-green font-black">Author</label>
                                                <div className="flex items-center gap-3 text-base font-bold">
                                                    <User size={16} className="text-bch-green" />
                                                    <span>{selectedContract.author || 'CrowdFund_BCH'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase tracking-[0.2em] text-bch-green font-black">Version</label>
                                                <div className="flex items-center gap-3 text-base font-bold">
                                                    <Layers size={16} className="text-bch-green" />
                                                    <span>{selectedContract.version}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase tracking-[0.2em] text-bch-green font-black">Created</label>
                                                <div className="flex items-center gap-3 text-base font-bold">
                                                    <Calendar size={16} className="text-bch-green" />
                                                    <span>2024-03-05</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] uppercase tracking-[0.2em] text-bch-green font-black">License</label>
                                                <div className="flex items-center gap-3 text-base font-bold">
                                                    <ShieldCheck size={16} className="text-bch-green" />
                                                    <span>Apache-2.0</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[10px] uppercase tracking-[0.2em] text-white font-black block mb-4">Tags</label>
                                            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                                                {selectedContract.tags?.map((t: string) => (
                                                    <span key={t} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-12 flex flex-col gap-4">
                                        <button
                                            onClick={() => {
                                                onLoadContract?.(selectedContract);
                                                setSelectedContract(null);
                                            }}
                                            className="w-full bg-bch-green text-bch-dark font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-[0_20px_40px_rgba(0,216,85,0.15)] active:translate-y-0 transform hover:-translate-y-1"
                                        >
                                            <Layers size={20} />
                                            <span className="text-lg">Load to Workspace</span>
                                        </button>

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => downloadContract(selectedContract)}
                                                className="w-full bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
                                            >
                                                <Download size={18} />
                                                <span>Download</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Code (60%) */}
                        <div className="flex-1 bg-black/40 flex flex-col min-w-0 min-h-0">
                            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-5">
                                    <div className="flex gap-2">
                                        <div className="w-3.5 h-3.5 rounded-full bg-red-500/30 border border-red-500/10" />
                                        <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/30 border border-yellow-500/10" />
                                        <div className="w-3.5 h-3.5 rounded-full bg-green-500/30 border border-green-500/10" />
                                    </div>
                                    <span className="text-sm font-mono text-white/30 tracking-tight">{selectedContract.title.toLowerCase().replace(/\s+/g, '-')}.cash</span>
                                </div>
                                <button
                                    onClick={() => copyCode(selectedContract.source_code || selectedContract.code)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/60 hover:text-white transition-all border border-white/5"
                                >
                                    {copied ? <Check size={14} className="text-bch-green" /> : <Copy size={14} />}
                                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                                </button>
                            </div>

                            <div className="flex-1 overflow-auto font-mono text-base custom-scrollbar bg-[#050507]">
                                <SyntaxHighlighter
                                    language="javascript"
                                    style={{
                                        ...atomDark,
                                        'comment': { ...atomDark['comment'], color: '#5c6370', fontStyle: 'italic' },
                                        'function': { ...atomDark['function'], color: '#40f0ff', fontWeight: 'bold' },
                                        'keyword': { ...atomDark['keyword'], color: '#ff79c6', fontWeight: 'bold' },
                                        'builtin': { color: '#00e5ff', fontWeight: '900' },
                                        'boolean': { ...atomDark['boolean'], color: '#ffb86c' },
                                        'number': { ...atomDark['number'], color: '#bd93f9' },
                                        'string': { ...atomDark['string'], color: '#50fa7b' },
                                        'operator': { ...atomDark['operator'], color: '#ff79c6' },
                                    }}
                                    customStyle={{
                                        margin: 0,
                                        padding: '28px',
                                        background: 'transparent',
                                        fontSize: '1rem',
                                        lineHeight: '1.6',
                                        letterSpacing: '-0.01em'
                                    }}
                                    codeTagProps={{
                                        style: {
                                            fontFamily: 'JetBrains Mono, Fira Code, monospace'
                                        }
                                    }}
                                >
                                    {selectedContract.source_code || selectedContract.code}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
