import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search, ShieldCheck, Download, Code2, User, FileWarning, Tag, Calendar, Layers, X, Copy, Check,
    ShieldAlert, History, Clock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { RegistryAuditLogEntry, RegistryContract } from '../types';
import {
    fetchRegistryContracts,
    fetchContractVersions,
    fetchRegistryAuditLog,
} from '../services/registryQueries';
import { stashPendingRegistryContract } from '../lib/pendingRegistryLoad';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface RegistryPageProps {
    onLoadContract?: (contract: RegistryContract) => void;
}

type DetailTab = 'current' | 'versions' | 'log';

function isHubRegistryHost(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'hub.nexops.cash';
}

function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return iso;
    }
}

function StatusBadges({ contract }: { contract: RegistryContract }) {
    const isValidated = contract.validation_status === 'validated';
    const isVerified = contract.visibility === 'verified';
    return (
        <div className="flex flex-wrap gap-2">
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${isValidated ? 'bg-bch-green/20 text-bch-green' : 'bg-amber-500/20 text-amber-300'}`}>
                {isValidated ? 'Validated' : 'Unsafe'}
            </span>
            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${isVerified ? 'bg-bch-green/20 text-bch-green' : 'bg-white/10 text-white/50'}`}>
                {isVerified ? 'Verified' : 'Community'}
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-1 rounded bg-white/5 text-white/60">
                Score {contract.audit_score ?? '—'}
            </span>
        </div>
    );
}

export const RegistryPage: React.FC<RegistryPageProps> = ({ onLoadContract }) => {
    const { user, signInWithGithub } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [showUnsafe, setShowUnsafe] = useState(false);
    const [contracts, setContracts] = useState<RegistryContract[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedContract, setSelectedContract] = useState<RegistryContract | null>(null);
    const [detailTab, setDetailTab] = useState<DetailTab>('current');
    const [versions, setVersions] = useState<RegistryContract[]>([]);
    const [auditLog, setAuditLog] = useState<RegistryAuditLogEntry[]>([]);
    const [viewingVersion, setViewingVersion] = useState<RegistryContract | null>(null);
    const [copied, setCopied] = useState(false);

    const loadContracts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchRegistryContracts({ latestOnly: true });
            setContracts(data);
        } catch (err: unknown) {
            console.error('Error fetching registry:', err);
            setError(err instanceof Error ? err.message : 'Failed to connect to Supabase.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadContracts();
    }, [loadContracts]);

    useEffect(() => {
        if (!selectedContract?.family_id) {
            setVersions([]);
            setAuditLog([]);
            return;
        }
        const familyId = selectedContract.family_id;
        void (async () => {
            try {
                const [vers, log] = await Promise.all([
                    fetchContractVersions(familyId),
                    fetchRegistryAuditLog(familyId),
                ]);
                setVersions(vers);
                setAuditLog(log);
            } catch (e) {
                console.error('Failed to load version/log data', e);
            }
        })();
    }, [selectedContract?.family_id]);

    useEffect(() => {
        if (!selectedContract) {
            setDetailTab('current');
            setViewingVersion(null);
        }
    }, [selectedContract]);

    const filteredContracts = useMemo(() => {
        return contracts
            .filter((c) => showUnsafe || c.validation_status === 'validated')
            .filter((c) => {
                const q = searchQuery.toLowerCase();
                return (
                    c.title.toLowerCase().includes(q) ||
                    (c.description ?? '').toLowerCase().includes(q) ||
                    (c.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
                );
            })
            .sort((a, b) => (b.audit_score ?? 0) - (a.audit_score ?? 0));
    }, [contracts, searchQuery, showUnsafe]);

    const displayContract = viewingVersion ?? selectedContract;

    const copyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadContract = (contract: RegistryContract) => {
        const code = contract.source_code;
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

    const openContract = (contract: RegistryContract) => {
        setSelectedContract(contract);
        setViewingVersion(null);
        setDetailTab('current');
    };

    const handleLoadToWorkspace = (contract: RegistryContract) => {
        if (user) {
            onLoadContract?.(contract);
            setSelectedContract(null);
            return;
        }
        stashPendingRegistryContract(contract);
        if (isHubRegistryHost()) {
            toast('Opening workspace on app.nexops.cash…', { duration: 5000 });
            window.location.href = 'https://app.nexops.cash/';
            return;
        }
        toast('After GitHub sign-in, this contract will open in your workspace.', { duration: 5000 });
        void signInWithGithub();
    };

    return (
        <div className="h-full bg-bch-dark selection:bg-bch-green/30 text-white overflow-y-auto">
            <main className="max-w-7xl mx-auto px-6 py-12 md:py-24">
                <div className="mb-16 text-center md:text-left">
                    <h2 className="text-5xl md:text-7xl font-display font-bold mb-8 leading-tight tracking-tight">
                        The era of <span className="text-bch-green">Programmable</span> Cash.
                    </h2>
                    <p className="text-xl text-white/60 max-w-2xl mb-12 font-medium leading-relaxed">
                        Explore audited smart contracts on Bitcoin Cash. Registry presence does not imply endorsement —
                        check validation and audit scores before use.
                    </p>

                    <div className="space-y-6">
                        <div className="relative max-w-2xl group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-bch-green transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="Search contracts by name, description, or tags..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 focus:outline-none focus:border-bch-green/30 focus:ring-1 focus:ring-bch-green/20 transition-all placeholder:text-white/20 text-lg"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                type="button"
                                onClick={() => setShowUnsafe(false)}
                                className={`px-5 py-2 rounded-full text-xs font-bold border transition-all ${!showUnsafe ? 'bg-bch-green/20 border-bch-green/40 text-bch-green' : 'bg-white/5 border-white/10 text-white/60'}`}
                            >
                                Validated only
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowUnsafe(true)}
                                className={`px-5 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${showUnsafe ? 'bg-amber-500/20 border-amber-500/40 text-amber-200' : 'bg-white/5 border-white/10 text-white/60'}`}
                            >
                                <FileWarning size={12} />
                                Show unsafe
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="py-24 flex justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bch-green" />
                    </div>
                ) : error ? (
                    <div className="py-20 text-center bg-red-500/10 rounded-3xl border border-red-500/20">
                        <p className="text-red-300 font-medium">{error}</p>
                    </div>
                ) : filteredContracts.length === 0 ? (
                    <div className="py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                        <p className="text-white/40 font-medium">No contracts match your filters.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredContracts.map((contract) => (
                            <div
                                key={contract.id}
                                onClick={() => openContract(contract)}
                                className="group relative bg-white/5 glass-panel rounded-[32px] p-8 cursor-pointer hover:bg-white/10 transition-all border border-white/5 hover:border-bch-green/30 hover:-translate-y-1 duration-300"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-4 rounded-2xl bg-bch-green/10 text-bch-green group-hover:bg-bch-green group-hover:text-bch-dark transition-all">
                                        <Code2 size={28} />
                                    </div>
                                    <StatusBadges contract={contract} />
                                </div>

                                <h3 className="text-2xl font-display font-bold mb-3 group-hover:text-bch-green transition-colors tracking-tight">
                                    {contract.title}
                                </h3>
                                <p className="text-white/40 text-sm line-clamp-2 mb-6 leading-relaxed font-medium">
                                    {contract.description}
                                </p>

                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-white/30">
                                        <User size={14} />
                                        <span>{contract.author_display_name || 'Anonymous'}</span>
                                    </div>
                                    <div className="text-xs font-mono font-bold text-bch-green/50">
                                        v{contract.version}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {selectedContract && displayContract && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <div
                        onClick={() => setSelectedContract(null)}
                        className="absolute inset-0 bg-bch-dark/80 backdrop-blur-2xl"
                    />

                    <div className="relative w-full max-w-7xl h-full max-h-[85vh] bg-bch-surface border border-white/10 rounded-[40px] overflow-hidden flex flex-col md:flex-row shadow-2xl text-left">
                        <div className="w-full md:w-[40%] flex-shrink-0 p-8 md:p-12 overflow-y-auto border-b md:border-b-0 md:border-r border-white/5">
                            <button
                                type="button"
                                onClick={() => setSelectedContract(null)}
                                className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white mb-6"
                            >
                                <X size={24} />
                            </button>

                            <StatusBadges contract={displayContract} />

                            {displayContract.validation_status === 'unsafe' && (
                                <p className="text-xs text-amber-200/90 mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                    <ShieldAlert className="w-4 h-4 shrink-0" />
                                    Published for community visibility — not endorsed. Review audit findings before use.
                                </p>
                            )}

                            <h2 className="text-4xl font-display font-bold mt-6 mb-4">{displayContract.title}</h2>
                            <p className="text-white/60 leading-relaxed mb-6">{displayContract.description}</p>

                            {displayContract.intent_description && (
                                <div className="mb-6">
                                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Intent</label>
                                    <p className="text-sm text-white/70 mt-1">{displayContract.intent_description}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-6 mb-8">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-bch-green font-black">Author</label>
                                    <div className="flex items-center gap-2 mt-1 font-bold">
                                        <User size={14} className="text-bch-green" />
                                        {displayContract.author_display_name || 'Anonymous'}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-bch-green font-black">Version</label>
                                    <div className="flex items-center gap-2 mt-1 font-bold">
                                        <Layers size={14} className="text-bch-green" />
                                        {displayContract.version}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-bch-green font-black">Created</label>
                                    <div className="flex items-center gap-2 mt-1 font-bold">
                                        <Calendar size={14} className="text-bch-green" />
                                        {formatDate(displayContract.created_at)}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-bch-green font-black">Source hash</label>
                                    <p className="text-[10px] font-mono text-white/40 mt-1 truncate" title={displayContract.source_hash}>
                                        {displayContract.source_hash?.slice(0, 16)}…
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
                                {(['current', 'versions', 'log'] as DetailTab[]).map((tab) => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => {
                                            setDetailTab(tab);
                                            if (tab === 'current') setViewingVersion(null);
                                        }}
                                        className={`text-[10px] font-black uppercase px-3 py-2 rounded-lg ${detailTab === tab ? 'bg-bch-green/20 text-bch-green' : 'text-white/40 hover:text-white'}`}
                                    >
                                        {tab === 'current' ? 'Current' : tab === 'versions' ? 'Versions' : 'Log'}
                                    </button>
                                ))}
                            </div>

                            {detailTab === 'versions' && (
                                <ul className="space-y-2 mb-6 max-h-40 overflow-y-auto">
                                    {versions.map((v) => (
                                        <li key={v.id}>
                                            <button
                                                type="button"
                                                onClick={() => setViewingVersion(v)}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${viewingVersion?.id === v.id ? 'bg-bch-green/20 text-bch-green' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                                            >
                                                v{v.version} · score {v.audit_score} · {v.validation_status}
                                                {v.is_latest ? ' (latest)' : ''}
                                            </button>
                                        </li>
                                    ))}
                                    {versions.length === 0 && (
                                        <li className="text-xs text-white/30">No version history.</li>
                                    )}
                                </ul>
                            )}

                            {detailTab === 'log' && (
                                <ul className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                                    {auditLog.map((entry) => (
                                        <li key={entry.id} className="text-xs bg-white/5 rounded-lg p-3 border border-white/5">
                                            <div className="flex items-center gap-2 text-white/50 mb-1">
                                                <History size={12} />
                                                <span className="font-black uppercase">{entry.action}</span>
                                                <Clock size={10} />
                                                <span>{formatDate(entry.created_at)}</span>
                                            </div>
                                            {entry.details && typeof entry.details === 'object' && (
                                                <p className="text-white/40 font-mono truncate">
                                                    {JSON.stringify(entry.details)}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                    {auditLog.length === 0 && (
                                        <li className="text-xs text-white/30">No actions logged yet.</li>
                                    )}
                                </ul>
                            )}

                            <div className="flex flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleLoadToWorkspace(displayContract)}
                                    className="w-full bg-bch-green text-bch-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:opacity-90"
                                >
                                    <Layers size={18} />
                                    Load to Workspace
                                </button>
                                <button
                                    type="button"
                                    onClick={() => downloadContract(displayContract)}
                                    className="w-full bg-white/5 border border-white/10 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 bg-black/40 flex flex-col min-w-0 min-h-0">
                            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                                <span className="text-sm font-mono text-white/30">
                                    {displayContract.title.toLowerCase().replace(/\s+/g, '-')}.cash
                                </span>
                                <button
                                    type="button"
                                    onClick={() => copyCode(displayContract.source_code)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 text-xs font-bold text-white/60 hover:text-white"
                                >
                                    {copied ? <Check size={14} className="text-bch-green" /> : <Copy size={14} />}
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto bg-[#050507]">
                                <SyntaxHighlighter
                                    language="javascript"
                                    style={atomDark}
                                    customStyle={{ margin: 0, padding: '24px', background: 'transparent', fontSize: '0.9rem' }}
                                >
                                    {displayContract.source_code}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
