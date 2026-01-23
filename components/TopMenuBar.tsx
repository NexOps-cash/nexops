import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Project } from '../types';

interface TopMenuBarProps {
    activeProject: Project | null;
    onAction: (action: string) => void;
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
    { label: 'Run', items: ['Compile Contract', 'Run Audit', 'Deploy'] },
    { label: 'Terminal', items: ['New Terminal', 'Split Terminal'] },
    { label: 'Help', items: ['Documentation', 'About NexOps'] },
];

export const TopMenuBar: React.FC<TopMenuBarProps> = ({ activeProject, onAction }) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const handleMenuClick = (menuLabel: string) => {
        setActiveMenu(activeMenu === menuLabel ? null : menuLabel);
    };

    const handleItemClick = (item: string) => {
        if (item !== '---') {
            onAction(item);
            setActiveMenu(null);
        }
    };

    return (
        <div className="h-[30px] bg-nexus-900 border-b border-slate-800 flex items-center justify-between px-2 relative z-50">
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
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveMenu(null)}
                                />

                                <div className="absolute top-full left-0 mt-1 bg-nexus-800 border border-slate-700 rounded shadow-xl py-1 min-w-[180px] z-50">
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

            {/* Right: Project Name */}
            <div className="text-xs text-slate-500 font-mono">
                {activeProject ? activeProject.name : 'No Project'}
            </div>
        </div>
    );
};
