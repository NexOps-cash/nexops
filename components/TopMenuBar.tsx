import React, { useState } from 'react';
import { ChevronDown, Github, User as UserIcon, Maximize, Minimize } from 'lucide-react';
import { Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { SystemHealthControl } from './SystemHealthControl';

interface TopMenuBarProps {
    activeProject: Project | null;
    onAction: (action: string) => void;
    isSyncing?: boolean;
    syncError?: string | null;
}

interface MenuItem {
    label: string;
    items: string[];
}

const menus: MenuItem[] = [
    { label: 'File', items: ['New Project', 'Open Project', 'Save', '---', 'Settings'] },
    { label: 'Edit', items: ['Undo', 'Redo', '---', 'Find', 'Replace'] },
    { label: 'Selection', items: ['Select All', 'Expand Selection'] },
    { label: 'View', items: ['Command Palette', 'Explorer', 'Audit', 'Deploy'] },
    { label: 'Run', items: ['Compile Contract', 'Run Audit', '---', 'Deploy', 'Publish to Registry'] },
    { label: 'Terminal', items: ['New Terminal', 'Split Terminal'] },
    { label: 'Help', items: ['Documentation', 'About NexOps'] },
];

export const TopMenuBar: React.FC<TopMenuBarProps> = ({ activeProject, onAction, isSyncing, syncError }) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { user, signInWithGithub, signOut } = useAuth();

    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const handleMenuClick = (menuLabel: string) => {
        setActiveMenu(activeMenu === menuLabel ? null : menuLabel);
    };

    const handleItemClick = (item: string) => {
        if (item === 'Documentation') {
            window.open('https://docs.nexops.cash', '_blank');
            setActiveMenu(null);
            return;
        }
        if (item === 'Publish to Registry') {
            onAction(item);
            setActiveMenu(null);
            return;
        }
        if (item === 'About NexOps') {
            window.location.href = 'https://app.nexops.cash';
            setActiveMenu(null);
            return;
        }
        if (item !== '---') {
            onAction(item);
            setActiveMenu(null);
        }
    };

    return (
        <div className="h-[32px] bg-nexus-900/80 backdrop-blur-sm border-b border-white/5 flex items-center justify-between px-2 relative z-[90]">
            {/* Left: Menu Items */}
            <div className="flex items-center space-x-1">
                {menus.map((menu) => (
                    <div key={menu.label} className="relative">
                        <button
                            onClick={() => handleMenuClick(menu.label)}
                            className={`px-3 py-1 text-xs transition-colors rounded ${activeMenu === menu.label
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            {menu.label}
                        </button>

                        {/* Dropdown */}
                        {activeMenu === menu.label && (
                            <>
                                {/* Backdrop to close menu */}
                                <div
                                    className="fixed inset-0 z-[90]"
                                    onClick={() => setActiveMenu(null)}
                                />

                                <div className="absolute top-full left-0 mt-1 bg-nexus-800 border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] z-[100] animate-in fade-in slide-in-from-top-1">
                                    {menu.items.map((item, idx) => (
                                        item === '---' ? (
                                            <div key={idx} className="h-px bg-slate-700 my-1" />
                                        ) : (
                                            <button
                                                key={idx}
                                                onClick={() => handleItemClick(item)}
                                                className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                            >
                                                {item}
                                            </button>
                                        )
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {/* Right: Project Name & Auth */}
            <div className="flex items-center space-x-4">
                {isSyncing && (
                    <div className="flex items-center space-x-1.5 text-nexus-cyan/40 animate-pulse">
                        <div className="w-1 h-1 rounded-full bg-nexus-cyan animate-bounce [animation-delay:-0.3s]"></div>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Syncing</span>
                    </div>
                )}
                {syncError && (
                    <div className="flex items-center space-x-1 text-red-500/60" title={syncError}>
                        <div className="w-1 h-1 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
                        <span className="text-[9px] font-bold uppercase tracking-wider">Offline</span>
                    </div>
                )}
                <div className="text-xs text-slate-500 font-mono hidden md:block">
                    {activeProject ? activeProject.name : 'No Project'}
                </div>

                <SystemHealthControl variant="topBar" />

                {/* Fullscreen Toggle */}
                <button
                    onClick={toggleFullscreen}
                    className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 hover:text-white transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                    {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>

                {/* Auth Section */}
                <div className="relative">
                    {!user ? (
                        <>
                            <button
                                onClick={() => handleMenuClick('Login')}
                                className="flex items-center space-x-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded transition-colors"
                            >
                                <span>Sign In</span>
                            </button>

                            {activeMenu === 'Login' && (
                                <>
                                    <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />
                                    <div className="absolute top-full right-0 mt-1 bg-nexus-800 border border-slate-700 rounded shadow-xl py-1 min-w-[200px] z-[100]">
                                        <button
                                            onClick={() => {
                                                signInWithGithub();
                                                setActiveMenu(null);
                                            }}
                                            className="w-full flex items-center space-x-2 text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
                                        >
                                            <Github className="w-4 h-4" />
                                            <span>Continue with GitHub</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => handleMenuClick('User')}
                                className="flex items-center space-x-2 px-2 py-1 hover:bg-slate-800 rounded transition-colors"
                            >
                                {user.user_metadata.avatar_url ? (
                                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-5 h-5 rounded-full" />
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                                        <UserIcon className="w-3 h-3 text-slate-400" />
                                    </div>
                                )}
                                <span className="text-xs text-slate-300">{user.user_metadata.user_name || user.email}</span>
                            </button>

                            {/* User Dropdown */}
                            {activeMenu === 'User' && (
                                <>
                                    <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />
                                    <div className="absolute top-full right-0 mt-1 bg-nexus-800 border border-slate-700 rounded shadow-xl py-1 min-w-[150px] z-[100]">
                                        <button
                                            onClick={() => {
                                                signOut();
                                                setActiveMenu(null);
                                            }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-slate-700 transition-colors"
                                        >
                                            Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
