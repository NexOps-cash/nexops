import React, { useState } from 'react';
import { LucideIcon, ChevronRight, Book, Shield, Zap, Layout as LayoutIcon, Cpu, HelpCircle, Terminal, FileCode, ShieldCheck } from 'lucide-react';

interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    section: string;
}

const NAV_ITEMS: NavItem[] = [
    { id: 'overview', label: 'System Overview', icon: LayoutIcon, section: 'Getting Started' },
    { id: 'intro', label: 'Introduction', icon: Book, section: 'Getting Started' },
    { id: 'concepts', label: 'Core Concepts', icon: Zap, section: 'Getting Started' },
    { id: 'architecture', label: 'Protocol Architecture', icon: Terminal, section: 'Protocol' },
    { id: 'pipeline', label: 'Intent Pipeline', icon: Cpu, section: 'Protocol' },
    { id: 'spec', label: 'Protocol Specification', icon: FileCode, section: 'Protocol' },
    { id: 'visualflow', label: 'VisualFlow Graph', icon: LayoutIcon, section: 'Mechanism' },
    { id: 'audit', label: 'AI Audit Engine', icon: Shield, section: 'Mechanism' },
    { id: 'security', label: 'Security Model', icon: ShieldCheck, section: 'Mechanism' },
    { id: 'devguide', label: 'Developer Guide', icon: Terminal, section: 'Support' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, section: 'Support' },
];

export const DocsLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeItem, setActiveItem] = useState('intro');

    // Group nav items by section
    const sections = NAV_ITEMS.reduce((acc, item) => {
        if (!acc[item.section]) acc[item.section] = [];
        acc[item.section].push(item);
        return acc;
    }, {} as Record<string, NavItem[]>);

    return (
        <div className="flex bg-[#0a0a0c] text-zinc-300 font-sans h-full w-full overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-[#0d0d0f] flex flex-col overflow-y-auto shrink-0">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-2 text-white font-bold tracking-tight">
                        <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-sm flex items-center justify-center">
                            <span className="text-[10px] text-black">NX</span>
                        </div>
                        <span>NEXOPS DOCS</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-6">
                    {Object.entries(sections).map(([sectionName, items]) => (
                        <div key={sectionName}>
                            <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-3 px-2">
                                {sectionName}
                            </h3>
                            <ul className="space-y-1">
                                {items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setActiveItem(item.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 text-sm ${activeItem === item.id
                                                ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                                : 'hover:bg-white/5 text-zinc-400 border border-transparent hover:text-white'
                                                }`}
                                        >
                                            <item.icon size={16} />
                                            <span>{item.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto bg-[#0a0a0c] relative">
                <div className="max-w-4xl mx-auto px-8 md:px-12 py-16">
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-8">
                        <span className="hover:text-zinc-300 cursor-pointer">Documentation</span>
                        <ChevronRight size={12} />
                        <span className="text-yellow-500/80">
                            {NAV_ITEMS.find(i => i.id === activeItem)?.label}
                        </span>
                    </div>

                    <article className="prose prose-invert prose-yellow max-w-none prose-h1:text-4xl prose-h1:font-bold prose-h1:tracking-tight prose-h2:text-2xl prose-h2:font-semibold prose-h2:border-b prose-h2:border-white/5 prose-h2:pb-2 prose-p:text-zinc-400 prose-li:text-zinc-400 prose-strong:text-white prose-code:text-yellow-500 prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/5">
                        {children}
                    </article>

                    {/* Pagination */}
                    <div className="mt-20 pt-8 border-t border-white/10 flex justify-between">
                        <button className="flex flex-col items-start gap-1 group">
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight">Previous</span>
                            <span className="text-sm font-medium text-zinc-400 group-hover:text-yellow-500 transition-colors">Introduction</span>
                        </button>
                        <button className="flex flex-col items-end gap-1 group">
                            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tight text-right">Next</span>
                            <span className="text-sm font-medium text-zinc-400 group-hover:text-yellow-500 transition-colors text-right underline decoration-yellow-500/30 underline-offset-4">The Problem</span>
                        </button>
                    </div>
                </div>
            </main>

            {/* Table of Contents (Right Sidebar) - Hidden on smaller screens */}
            <aside className="w-64 border-l border-white/5 bg-[#0d0d0f]/50 p-8 hidden xl:block shrink-0">
                <h4 className="text-[11px] font-bold text-white uppercase tracking-wider mb-6">On this page</h4>
                <ul className="space-y-4 border-l border-white/5 pl-4">
                    <li className="text-sm text-yellow-500/80 hover:text-yellow-500 cursor-pointer transition-colors border-l-2 border-yellow-500 -ml-[17px] pl-[15px]">
                        Protocol Overview
                    </li>
                    <li className="text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                        Cognitive Stack Design
                    </li>
                    <li className="text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                        UTXO Mental Model
                    </li>
                    <li className="text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                        Intent Pipeline Lifecycle
                    </li>
                    <li className="text-sm text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors">
                        Security Toll Gates
                    </li>
                </ul>

                <div className="mt-16 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10 hover:bg-yellow-500/10 transition-all duration-300 group">
                    <p className="text-xs text-yellow-500/60 leading-relaxed italic group-hover:text-yellow-500/80">
                        "We believe developers should spend 90% of their time on logic, and let AI handle the 10% of infrastructure friction."
                    </p>
                </div>
            </aside>
        </div>
    );
};
