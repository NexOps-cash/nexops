import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Play, ShieldCheck, Rocket, Terminal as TerminalIcon, XCircle, Eraser, Cpu, Activity, AlertCircle, ChevronDown } from 'lucide-react';

export type TerminalChannel = 'SYSTEM' | 'COMPILER' | 'AUDITOR' | 'PROBLEMS';

interface NamedTaskTerminalProps {
    onRunTask: (taskName: string) => void;
    channelLogs: Record<TerminalChannel, string[]>;
    onActiveChannelChange: (channel: TerminalChannel) => void;
    activeChannel: TerminalChannel;
    onClearLogs: (channel: TerminalChannel) => void;
    problemsContent?: React.ReactNode;
    problemsCount?: number;
    securityScore?: number;
    detectorsTriggered?: number;
    retryCount?: number;
    auditStatus?: 'READY' | 'RUNNING' | 'PASSED' | 'FAILED';
    convergenceStatus?: 'DETERMINISTIC' | 'UNSTABLE' | 'FAILED' | 'NONE';
}

export const NamedTaskTerminal: React.FC<NamedTaskTerminalProps> = ({
    onRunTask,
    channelLogs,
    activeChannel,
    onActiveChannelChange,
    onClearLogs,
    problemsContent,
    problemsCount = 0,
    securityScore = 0.00,
    detectorsTriggered = 0,
    retryCount = 0,
    auditStatus = 'READY',
    convergenceStatus = 'NONE'
}) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const [terminalReady, setTerminalReady] = useState(false);
    const [logFilter, setLogFilter] = useState<'ALL' | 'ERRORS' | 'WARNINGS'>('ALL');

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
        term.writeln(`\x1b[1;36mλ nexops --channel=${activeChannel.toLowerCase()} --filter=${logFilter.toLowerCase()}\x1b[0m`);

        const logs = [...(channelLogs[activeChannel] || [])].reverse();
        // Write logs
        logs.forEach(log => {
            const lowLog = log.toLowerCase();
            const isError = lowLog.includes('error') || lowLog.includes('critical') || lowLog.includes('failed');
            const isWarning = lowLog.includes('warning');

            if (logFilter === 'ERRORS' && !isError) return;
            if (logFilter === 'WARNINGS' && !isWarning && !isError) return;

            // Extract optional timestamp if existing, else add one
            let displayLog = log;
            if (!/^\[\d{1,2}:\d{2}:\d{2} [AP]M\]/.test(log)) {
                const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                displayLog = `[${ts}] ${log}`;
            }

            if (isError) {
                term.writeln(`\x1b[31m[ERROR] ${displayLog}\x1b[0m`);
            } else if (isWarning) {
                term.writeln(`\x1b[33m[WARNING] ${displayLog}\x1b[0m`);
            } else if (lowLog.includes('success') || lowLog.includes('passed') || lowLog.includes('secured')) {
                term.writeln(`\x1b[32m[SUCCESS] ${displayLog}\x1b[0m`);
            } else {
                term.writeln(`[INFO] ${displayLog}`);
            }
        });

        // Small delay then scroll to bottom to ensure it fires after render
        // Auto-scroll disabled to prevent jumping to bottom on new logs
    }, [activeChannel, channelLogs, terminalReady, logFilter]);

    // Channel configuration
    const channelConfig: { id: TerminalChannel; label: string; icon: any; color: string; count?: number }[] = [
        { id: 'SYSTEM', label: 'System', icon: TerminalIcon, color: 'bg-blue-500' },
        { id: 'COMPILER', label: 'Compiler', icon: Cpu, color: 'bg-orange-500' },
        { id: 'AUDITOR', label: 'Auditor', icon: ShieldCheck, color: 'bg-red-500' },
        { id: 'PROBLEMS', label: 'Problems', icon: AlertCircle, count: problemsCount, color: 'bg-yellow-500' }
    ];

    return (
        <div className="flex flex-col h-full bg-[#0a0a0c] border border-white/5 rounded-lg overflow-hidden relative">

            {/* Extended Multi-Channel Toolbar */}
            <div className="flex items-center bg-[#050507] border-b border-white/5 h-9 px-2 shrink-0">
                <div className="flex items-center bg-black/40 rounded-md p-0.5 border border-white/5 mr-4 overflow-x-auto no-scrollbar">
                    {channelConfig.map(chn => (
                        <button
                            key={chn.id}
                            onClick={() => onActiveChannelChange(chn.id)}
                            className={`
                                flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-tight transition-all relative whitespace-nowrap
                                ${activeChannel === chn.id
                                    ? 'bg-nexus-cyan/10 text-nexus-cyan shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]'
                                    : 'text-slate-500 hover:text-slate-300'
                                }
                            `}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${chn.color} ${activeChannel === chn.id ? 'shadow-[0_0_5px_currentColor] animate-pulse' : 'opacity-50'}`} />
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

                <div className="h-4 w-px bg-white/5 mx-2 hidden sm:block" />

                <div className="hidden sm:flex items-center gap-2">
                    <button
                        onClick={() => onRunTask('COMPILE')}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1e] border border-white/10 hover:border-nexus-cyan/40 text-slate-400 hover:text-nexus-cyan rounded text-[10px] uppercase font-black tracking-tight transition-all active:scale-95 group shadow-lg"
                        title="Compile active contract"
                    >
                        <Cpu size={10} className="group-hover:drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" />
                        <span>Compile</span>
                    </button>

                    <button
                        onClick={() => onRunTask('AUDIT')}
                        className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1e] border border-white/10 hover:border-green-500/40 text-slate-400 hover:text-green-500 rounded text-[10px] uppercase font-black tracking-tight transition-all active:scale-95 group shadow-lg"
                        title="Run Security Audit"
                    >
                        <ShieldCheck size={10} className="group-hover:drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]" />
                        <span>Audit Registry</span>
                    </button>
                </div>

                <div className="flex-1" />

                {/* Log Filters */}
                {activeChannel !== 'PROBLEMS' && (
                    <div className="flex items-center bg-black/40 rounded-md p-0.5 border border-white/5 mr-2">
                        {(['ALL', 'ERRORS', 'WARNINGS'] as const).map(filter => (
                            <button
                                key={filter}
                                onClick={() => setLogFilter(filter)}
                                className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-colors ${logFilter === filter ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => onClearLogs(activeChannel)}
                    className="flex items-center gap-1.5 px-2 py-1 text-slate-600 hover:text-red-400 transition-colors rounded hover:bg-red-400/5 mr-1"
                    title="Clear Console Logs"
                >
                    <Eraser size={12} />
                    <span className="text-[9px] uppercase font-bold tracking-wider hidden sm:block">Clear Console</span>
                </button>

                <button
                    onClick={() => xtermRef.current?.scrollToBottom()}
                    className="p-1.5 text-slate-600 hover:text-nexus-cyan transition-colors rounded hover:bg-white/5"
                    title="Scroll to Bottom"
                >
                    <ChevronDown size={14} />
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
