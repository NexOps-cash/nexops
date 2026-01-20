
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Play, ShieldCheck, Rocket, Terminal as TerminalIcon, XCircle, Eraser } from 'lucide-react';

interface NamedTaskTerminalProps {
    onRunTask: (taskName: string) => void;
    logs: string[];
}

export const NamedTaskTerminal: React.FC<NamedTaskTerminalProps> = ({ onRunTask, logs }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    // -- Initialize xterm --
    useEffect(() => {
        if (!terminalRef.current) return;
        if (xtermRef.current) return; // Prevent double init

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0f172a', // slate-900 
                foreground: '#94a3b8', // slate-400
                cursor: '#06b6d4', // nexus-cyan
                selectionBackground: 'rgba(6, 182, 212, 0.3)',
                black: '#0f172a',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#d946ef',
                cyan: '#06b6d4',
                white: '#f8fafc',
            },
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: 12,
            lineHeight: 1.2,
            disableStdin: true,
            allowProposedApi: true,
            scrollback: 5000 // Allow scrolling back 5000 lines
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Initial fit - wrapped in timeout to ensure DOM layout is complete
        setTimeout(() => {
            try {
                fitAddon.fit();
            } catch (e) {
                console.warn("Initial fit failed, retrying in observer", e);
            }
        }, 50);

        term.writeln('\x1b[1;36m$ nexops-cli verified\x1b[0m');
        term.writeln('Ready for tasks.');

        // Robust Resize Observer
        observerRef.current = new ResizeObserver(() => {
            try {
                // Check if container has dimensions
                if (terminalRef.current && terminalRef.current.clientWidth > 0) {
                    fitAddon.fit();
                }
            } catch (e) {
                // Ignore transient fit errors during rapid resize
            }
        });

        observerRef.current.observe(terminalRef.current);

        return () => {
            observerRef.current?.disconnect();
            term.dispose();
            xtermRef.current = null;
        };
    }, []);

    // -- Update Logs --
    useEffect(() => {
        if (!xtermRef.current) return;

        xtermRef.current.clear();
        xtermRef.current.writeln('\x1b[1;36m$ nexops-cli verified\x1b[0m');
        xtermRef.current.writeln('Ready for tasks.');

        logs.forEach(log => {
            if (log.toLowerCase().includes('error')) {
                xtermRef.current?.writeln(`\x1b[31m${log}\x1b[0m`);
            } else if (log.toLowerCase().includes('success') || log.includes('Done') || log.includes('✅')) {
                xtermRef.current?.writeln(`\x1b[32m${log}\x1b[0m`);
            } else {
                xtermRef.current?.writeln(log);
            }
        });

        // Scroll to bottom after write
        xtermRef.current.scrollToBottom();

    }, [logs]);

    return (
        <div className="h-full flex flex-col bg-slate-900 border-t border-slate-800">
            {/* Toolbar */}
            <div className="flex items-center px-4 py-2 border-b border-slate-700/50 bg-slate-900/50 space-x-2">
                <div className="flex items-center space-x-1 text-slate-400 text-[10px] uppercase font-bold tracking-wider mr-4">
                    <TerminalIcon size={12} className="text-nexus-cyan" />
                    <span>Tasks</span>
                </div>

                <div className="h-4 w-px bg-slate-700 mx-2" />

                <button
                    onClick={() => onRunTask('COMPILE')}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded text-[10px] transition-colors"
                >
                    <Play size={10} />
                    <span>Compile</span>
                </button>

                <button
                    onClick={() => onRunTask('AUDIT')}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded text-[10px] transition-colors"
                >
                    <ShieldCheck size={10} />
                    <span>Audit</span>
                </button>

                <button
                    onClick={() => onRunTask('DEPLOY')}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-400 rounded text-[10px] transition-colors"
                >
                    <Rocket size={10} />
                    <span>Deploy</span>
                </button>

                <div className="flex-1" />

                <button
                    onClick={() => { /* clear handled via logs prop in this simplistic version */ }}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    title="Clear Terminal"
                >
                    <Eraser size={12} />
                </button>
            </div>

            {/* XTerm Container - Fixed: Removed overflow-hidden to allow scrollbar */}
            <div className="flex-1 relative bg-[#0f172a] min-h-0 pl-2">
                <div ref={terminalRef} className="absolute inset-0 h-full w-full" />
            </div>
        </div>
    );
};
