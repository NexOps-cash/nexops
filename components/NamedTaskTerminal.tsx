import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Play, ShieldCheck, Rocket, Terminal as TerminalIcon, XCircle, Eraser, Cpu, Activity, AlertCircle, ChevronDown } from 'lucide-react';

export type TerminalChannel = 'SYSTEM' | 'COMPILER' | 'AUDITOR' | 'PROBLEMS';

interface NamedTaskTerminalProps {
    onRunTask: (taskName: string) => void;
    channelLogs: Record<TerminalChannel, string[]>;
    activeChannel: TerminalChannel;
    onActiveChannelChange: (channel: TerminalChannel) => void;
    onClearLogs: (channel: TerminalChannel) => void;
    problemsContent?: React.ReactNode;
    problemsCount?: number;
}

export const NamedTaskTerminal: React.FC<NamedTaskTerminalProps> = ({
    onRunTask,
    channelLogs,
    activeChannel,
    onActiveChannelChange,
    onClearLogs,
    problemsContent,
    problemsCount = 0
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const [terminalReady, setTerminalReady] = useState(false);

    // -- Initialize xterm --
    useEffect(() => {
        if (!terminalRef.current) return;
        if (xtermRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0a0a0c', // Deep near-black
                foreground: '#cbd5e1', // slate-300
                cursor: '#06b6d4', // nexus-cyan
                selectionBackground: 'rgba(6, 182, 212, 0.3)',
                black: '#0a0a0c',
                red: '#ef4444',
                green: '#22c55e',
                yellow: '#eab308',
                blue: '#3b82f6',
                magenta: '#d946ef',
                cyan: '#06b6d4',
                white: '#f8fafc',
            },
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontSize: 11,
            lineHeight: 1.4,
            disableStdin: true,
            allowProposedApi: true,
            scrollback: 5000
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        setTerminalReady(true);

        // Immediate feedback
        term.writeln('\x1b[1;36m[System] Initializing NexOps Terminal Session...\x1b[0m');
        term.writeln('\x1b[2mConnecting to virtual kernel...\x1b[0m');

        setTimeout(() => {
            try {
                if (terminalRef.current && terminalRef.current.clientWidth > 0) {
                    fitAddon.fit();
                }
            } catch (e) { }
        }, 150);

        // Robust Resize Observer with multi-stage fitting
        observerRef.current = new ResizeObserver(() => {
            const runFit = () => {
                try {
                    if (terminalRef.current && terminalRef.current.clientWidth > 0) {
                        fitAddon.fit();
                    }
                } catch (e) { }
            };

            runFit();
            // Multi-stage fit to ensure DOM has settled after panel resize
            const t1 = setTimeout(runFit, 50);
            const t2 = setTimeout(runFit, 150);
            const t3 = setTimeout(runFit, 300);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        });

        observerRef.current.observe(terminalRef.current);

        return () => {
            observerRef.current?.disconnect();
            term.dispose();
            xtermRef.current = null;
            setTerminalReady(false);
        };
    }, []);

    // -- Sync Logs for Active Channel --
    useEffect(() => {
        if (!terminalReady || !xtermRef.current || activeChannel === 'PROBLEMS') return;
        const term = xtermRef.current;

        term.clear();
        term.writeln(`\x1b[1;36mλ nexops --channel=${activeChannel.toLowerCase()}\x1b[0m`);

        const logs = [...(channelLogs[activeChannel] || [])].reverse();
        // Write logs
        logs.forEach(log => {
            if (log.toLowerCase().includes('error') || log.toLowerCase().includes('failed')) {
                term.writeln(`\x1b[31m${log}\x1b[0m`);
            } else if (log.toLowerCase().includes('success') || log.includes('Done') || log.includes('✅')) {
                term.writeln(`\x1b[32m${log}\x1b[0m`);
            } else if (log.startsWith('[System]') || log.startsWith('[Debug]')) {
                term.writeln(`\x1b[34m${log}\x1b[0m`);
            } else {
                term.writeln(log);
            }
        });

        const doScroll = () => {
            if (fitAddonRef.current) {
                try {
                    fitAddonRef.current.fit();
                } catch (e) { }
            }
            term.scrollToTop();
        };

        requestAnimationFrame(doScroll);
        const t1 = setTimeout(doScroll, 50);
        const t2 = setTimeout(doScroll, 150);
        const t3 = setTimeout(doScroll, 400);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [channelLogs, activeChannel, terminalReady]);

    const channelConfig: { id: TerminalChannel; label: string; icon: any; count?: number }[] = [
        { id: 'SYSTEM', label: 'System', icon: Activity },
        { id: 'COMPILER', label: 'Compiler', icon: Cpu },
        { id: 'AUDITOR', label: 'Auditor', icon: ShieldCheck },
        { id: 'PROBLEMS', label: 'Problems', icon: AlertCircle, count: problemsCount },
    ];

    return (
        <div className="h-full flex flex-col bg-[#0a0a0c]">
            {/* Extended Multi-Channel Toolbar */}
            <div className="flex items-center bg-[#0d0d0f] border-b border-white/5 h-9 px-2">
                <div className="flex items-center bg-black/40 rounded-md p-0.5 border border-white/5 mr-4">
                    {channelConfig.map(chn => (
                        <button
                            key={chn.id}
                            onClick={() => onActiveChannelChange(chn.id)}
                            className={`
                                flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-tight transition-all relative
                                ${activeChannel === chn.id
                                    ? 'bg-nexus-cyan/10 text-nexus-cyan shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]'
                                    : 'text-slate-500 hover:text-slate-300'
                                }
                            `}
                        >
                            <chn.icon size={12} strokeWidth={activeChannel === chn.id ? 2.5 : 1.5} />
                            <span>{chn.label}</span>
                            {chn.count && chn.count > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                                    {chn.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="h-4 w-px bg-white/5 mx-2" />

                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onRunTask('COMPILE')}
                        className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-white/5 text-slate-400 hover:text-nexus-cyan rounded text-[10px] transition-colors"
                        title="Compile active contract"
                    >
                        <Play size={10} />
                        <span>Compile</span>
                    </button>

                    <button
                        onClick={() => onRunTask('AUDIT')}
                        className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-white/5 text-slate-400 hover:text-nexus-cyan rounded text-[10px] transition-colors"
                        title="Run Security Audit"
                    >
                        <ShieldCheck size={10} />
                        <span>Audit</span>
                    </button>
                </div>

                <div className="flex-1" />

                <button
                    onClick={() => xtermRef.current?.scrollToBottom()}
                    className="p-1.5 text-slate-600 hover:text-nexus-cyan transition-colors rounded hover:bg-white/5 mr-1"
                    title="Scroll to Bottom"
                >
                    <ChevronDown size={14} />
                </button>

                <button
                    onClick={() => onClearLogs(activeChannel)}
                    className="p-1.5 text-slate-600 hover:text-red-400 transition-colors rounded hover:bg-red-400/5"
                    title="Clear current channel"
                >
                    <Eraser size={14} />
                </button>
            </div>

            {/* Container */}
            <div className="flex-1 relative bg-[#0a0a0c] min-h-0 overflow-hidden">
                {/* Problems View */}
                {problemsContent && (
                    <div className={`absolute inset-0 overflow-auto no-scrollbar bg-[#0a0a0c] transition-opacity duration-200 ${activeChannel === 'PROBLEMS' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                        <div className="p-2 pb-8">
                            {problemsContent}
                        </div>
                    </div>
                )}

                {/* Terminal View */}
                <div className={`absolute inset-0 bg-[#0a0a0c] transition-opacity duration-200 ${activeChannel !== 'PROBLEMS' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <div className="absolute inset-x-2 inset-y-1 pb-4 overflow-hidden">
                        <div ref={terminalRef} className="h-full w-full" />
                    </div>
                </div>
            </div>

        </div>
    );
};
