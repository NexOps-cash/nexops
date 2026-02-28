import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import {
    Plus, Wallet, Trash2, Zap, CheckCircle2,
    Copy, ExternalLink, RefreshCw, ChevronRight,
    User, Target, ShieldCheck
} from 'lucide-react';
import { Button } from './UI';
import { toast } from 'react-hot-toast';
import { getExplorerLink } from '../services/blockchainService';

export const WalletSidebar: React.FC = () => {
    const {
        wallets,
        activeWalletId,
        addWallet,
        removeWallet,
        setActiveWallet,
        refreshBalances,
        fundWallet
    } = useWallet();

    const [newWalletName, setNewWalletName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWalletName.trim()) return;

        setIsCreating(true);
        await addWallet(newWalletName.trim());
        setNewWalletName('');
        setIsCreating(false);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await refreshBalances();
        setIsRefreshing(false);
        toast.success("Balances updated.");
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0c] text-white">
            {/* Header / Actions */}
            <div className="p-4 border-b border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Global Identities</h3>
                    <button
                        onClick={handleRefresh}
                        className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${isRefreshing ? 'animate-spin text-nexus-cyan' : 'text-slate-400'}`}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Wallet Name (e.g. Owner)"
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-nexus-cyan/50 transition-colors"
                        value={newWalletName}
                        onChange={(e) => setNewWalletName(e.target.value)}
                        disabled={isCreating}
                    />
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        className="p-2 aspect-square rounded-xl"
                        isLoading={isCreating}
                    >
                        <Plus size={16} />
                    </Button>
                </form>
            </div>

            {/* Wallet List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
                {wallets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-center space-y-3 opacity-40">
                        <Wallet size={32} className="text-slate-600" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Identities Created</p>
                    </div>
                ) : (
                    wallets.map((wallet) => {
                        const isActive = wallet.id === activeWalletId;
                        return (
                            <div
                                key={wallet.id}
                                onClick={() => setActiveWallet(wallet.id)}
                                className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${isActive
                                    ? 'bg-nexus-cyan/10 border-nexus-cyan/40 ring-1 ring-nexus-cyan/20'
                                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:bg-white/[0.04]'
                                    }`}
                            >
                                {/* Active Indicator */}
                                {isActive && (
                                    <div className="absolute top-4 right-4 text-nexus-cyan">
                                        <CheckCircle2 size={14} />
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-xl border ${isActive ? 'bg-nexus-cyan/20 border-nexus-cyan/20 text-nexus-cyan' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                                        <User size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm truncate uppercase tracking-tight">{wallet.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] font-mono text-slate-500 truncate">{wallet.address.slice(0, 10)}...{wallet.address.slice(-6)}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Balance</span>
                                        <span className={`text-xs font-mono font-bold ${wallet.balance && wallet.balance > 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                            {(wallet.balance || 0).toLocaleString()} <span className="text-[9px] opacity-60">SATS</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fundWallet(wallet.id);
                                            }}
                                            className="p-1.5 hover:bg-nexus-cyan/20 rounded-lg text-nexus-cyan transition-colors"
                                            title="Request Faucet"
                                        >
                                            <Zap size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(wallet.address, 'Address');
                                            }}
                                            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                                            title="Copy Address"
                                        >
                                            <Copy size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeWallet(wallet.id);
                                            }}
                                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                                            title="Remove Identity"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Help / Footer */}
            <div className="p-4 bg-black/20 border-t border-white/5 mt-auto">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-nexus-cyan/5 border border-nexus-cyan/10">
                    <ShieldCheck size={16} className="text-nexus-cyan mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                        Identities are stored locally in your browser session. They persistence allows you to use distinct owners & funders across contracts.
                    </p>
                </div>
            </div>
        </div>
    );
};
