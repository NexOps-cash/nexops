import React from 'react';
import { Github, User as UserIcon, ShieldCheck, Box, Zap, FileCode, StickyNote, Home, FileWarning } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TopNavProps {
    activeView: string;
    onNavigate: (view: any) => void;
    isSyncing?: boolean;
    syncError?: string | null;
}

export const TopNav: React.FC<TopNavProps> = ({ activeView, onNavigate, isSyncing, syncError }) => {
    const { user, signInWithGithub, signInWithGoogle, signOut } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);

    const navItems = [
        { id: 'workspace', label: 'Workspace', icon: FileCode },
        { id: 'wizard', label: 'Wizard', icon: Zap },
        { id: 'registry', label: 'Registry', icon: Box },
        { id: 'docs', label: 'Docs', icon: StickyNote },
    ];

    return (
        <nav className="h-16 bg-nexus-900/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-[100]">
            {/* Left: Logo */}
            <div
                className="flex items-center space-x-3 cursor-pointer group"
                onClick={() => onNavigate('home')}
            >
                <img
                    src="/dist/assets/Gemini_Generated_Image_3rwexy3rwexy3rwe.png"
                    alt="NexOps Logo"
                    className="w-10 h-10 object-contain rounded-lg"
                />
                <span className="text-white font-black tracking-tighter text-xl">NexOps</span>
            </div>

            {/* Center: Nav Links */}
            <div className="hidden md:flex items-center space-x-8">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => item.id !== 'docs' && onNavigate(item.id)}
                        className={`text-sm font-medium transition-colors hover:text-white flex items-center ${activeView === item.id ? 'text-nexus-cyan' : 'text-slate-400'
                            }`}
                    >
                        {item.label}
                        {item.id === 'docs' && <span className="ml-1 text-[10px] opacity-50 uppercase tracking-tighter">(Soon)</span>}
                    </button>
                ))}
            </div>

            {/* Right: Auth */}
            <div className="flex items-center space-x-6">
                {isSyncing && (
                    <div className="flex items-center space-x-2 text-nexus-cyan/60 animate-pulse">
                        <div className="w-1.5 h-1.5 rounded-full bg-nexus-cyan animate-bounce"></div>
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Syncing...</span>
                    </div>
                )}
                {syncError && (
                    <div className="flex items-center space-x-2 text-red-400">
                        <FileWarning className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{syncError}</span>
                    </div>
                )}
                {!user ? (
                    <button
                        onClick={signInWithGithub}
                        className="flex items-center space-x-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm rounded-lg transition-all"
                    >
                        <Github className="w-4 h-4" />
                        <span>Sign In</span>
                    </button>
                ) : (
                    <div className="relative">
                        <button
                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                            className="flex items-center space-x-3 px-3 py-1.5 hover:bg-white/5 rounded-lg transition-all border border-transparent hover:border-white/10"
                        >
                            <div className="w-7 h-7 rounded-full bg-nexus-cyan/20 border border-nexus-cyan/30 flex items-center justify-center overflow-hidden">
                                {user.user_metadata.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <UserIcon className="w-4 h-4 text-nexus-cyan" />
                                )}
                            </div>
                            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
                                {user.user_metadata.user_name || user.email?.split('@')[0]}
                            </span>
                        </button>

                        {/* Dropdown */}
                        {isUserMenuOpen && (
                            <>
                                <div className="fixed inset-0" onClick={() => setIsUserMenuOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 w-48 bg-nexus-800 border border-white/10 rounded-xl shadow-2xl py-2 z-[110] animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-2 border-b border-white/5 mb-1">
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Account</p>
                                        <p className="text-xs text-slate-300 truncate">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            signOut();
                                            setIsUserMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
};
