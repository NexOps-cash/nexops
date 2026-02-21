import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Loader2, Play, Copy, Terminal, ChevronDown, Plus } from 'lucide-react';
import { Button } from './UI';
import { AuditReportView } from './AuditReportView';
import { AuditReport, Vulnerability } from '../types';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    fileUpdates?: { name: string, content: string }[];
    isApplied?: boolean;
    auditReport?: AuditReport;
    isProgress?: boolean;
    stage?: string;
}

interface AIPanelProps {
    history: ChatMessage[];
    onSend: (message: string) => void;
    isBusy: boolean;
    onApply: (updates: { name: string, content: string }[], index: number) => void;
    onFixVulnerability?: (vuln: Vulnerability) => void;
    draftInput?: string;
    useExternalGenerator?: boolean;
    onToggleExternal?: (val: boolean) => void;
    isWsConnected?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({
    history, onSend, isBusy, onApply, onFixVulnerability, draftInput,
    useExternalGenerator = false, onToggleExternal, isWsConnected = false
}) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Update input when draftInput changes
    useEffect(() => {
        if (draftInput) {
            setInput(draftInput);
        }
    }, [draftInput]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, isBusy]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isBusy) {
                onSend(input);
                setInput('');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#0d0d0d] font-mono text-xs text-gray-300">
            {/* Context / Segmented Control Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a2a] bg-[#111]">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 border border-[#2a2a2a] rounded cursor-pointer hover:bg-[#222] transition-colors text-gray-400">
                        <span className="font-medium">Agent</span>
                        <ChevronDown size={10} />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${useExternalGenerator ? (isWsConnected ? 'bg-nexus-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'bg-red-500') : 'bg-slate-600'}`}></span>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                            {useExternalGenerator ? (isWsConnected ? 'MCP: ACTIVE' : 'MCP: ERROR') : 'INTERNAL RAG'}
                        </span>
                    </div>

                    <button
                        onClick={() => onToggleExternal && onToggleExternal(!useExternalGenerator)}
                        className={`
                            relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none focus:ring-1 focus:ring-nexus-cyan focus:ring-offset-1 focus:ring-offset-black
                            ${useExternalGenerator ? 'bg-nexus-cyan/40' : 'bg-slate-800'}
                        `}
                        title={useExternalGenerator ? "Switch to Internal AI" : "Switch to External Generator"}
                    >
                        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${useExternalGenerator ? 'translate-x-4.5' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Output Panel */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-0">
                {history.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                        <Terminal size={32} className="mb-2" />
                        <p>AI Developer Console Ready</p>
                    </div>
                )}

                {history.map((msg, i) => (
                    <div key={i} className="border-b border-[#1a1a1a] last:border-0">
                        <div className={`p-4 ${msg.role === 'user' ? 'bg-[#151515]' : ''}`}>
                            <div className="flex items-start gap-3">
                                {/* Indicator Line instead of Avatar */}
                                <div className={`w-0.5 self-stretch ${msg.role === 'user' ? 'bg-nexus-cyan' : 'bg-purple-500/50'}`}></div>

                                <div className="flex-1 overflow-hidden">
                                    {/* Role Label - minimal */}
                                    <div className="mb-1 text-[10px] opacity-40 uppercase tracking-widest font-bold">
                                        {msg.role === 'user' ? 'Input' : 'Output'}
                                    </div>

                                    {/* Content */}
                                    <div className="whitespace-pre-wrap leading-relaxed text-gray-300">
                                        {msg.isProgress ? (
                                            <div className="flex items-center gap-3 bg-[#0a0a0a] border border-nexus-cyan/20 p-2.5 rounded border-l-2 border-l-nexus-cyan animate-pulse">
                                                <div className="w-1.5 h-1.5 rounded-full bg-nexus-cyan animate-ping"></div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                                        <Terminal size={10} />
                                                        {msg.stage || 'Generator'}
                                                    </span>
                                                    <span className="text-yellow-500/90 font-mono text-[11px] mt-0.5">
                                                        {msg.text.split('] ')[1] || msg.text}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>

                                    {/* Actions for Model Responses */}
                                    {msg.role === 'model' && (
                                        <div className="mt-3 flex flex-col gap-2">
                                            {msg.auditReport && (
                                                <AuditReportView
                                                    report={msg.auditReport}
                                                    onFix={(v) => onFixVulnerability && onFixVulnerability(v)}
                                                />
                                            )}

                                            <div className="flex items-center gap-2">
                                                {msg.fileUpdates && (
                                                    <button
                                                        onClick={() => onApply(msg.fileUpdates!, i)}
                                                        disabled={msg.isApplied}
                                                        className={`
                                                        flex items-center gap-1.5 px-2 py-1 rounded border transition-colors
                                                        ${msg.isApplied
                                                                ? 'border-green-900/30 bg-green-900/10 text-green-500 cursor-default'
                                                                : 'border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white'
                                                            }
                                                    `}
                                                    >
                                                        <Plus size={10} />
                                                        {msg.isApplied ? 'Applied' : 'Insert'}
                                                    </button>
                                                )}
                                                <button className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-white transition-colors">
                                                    <Copy size={10} />
                                                    Copy
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Command Bar */}
            <div className="p-3 bg-[#0d0d0d] border-t border-[#2a2a2a]">
                <div className="
                    flex items-center px-3 py-2 
                    bg-[#151515] border border-[#2a2a2a] 
                    rounded-md focus-within:border-nexus-cyan/50 focus-within:ring-1 focus-within:ring-nexus-cyan/20
                    transition-all
                ">
                    <input
                        className="flex-1 bg-transparent outline-none text-sm text-gray-200 placeholder-gray-600"
                        placeholder="Add a follow-up..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isBusy}
                        autoFocus
                    />

                    <div className="flex items-center gap-3 ml-2 pl-2 border-l border-[#2a2a2a]">
                        <button className="text-gray-500 hover:text-gray-300 transition-colors" title="Attach Context">
                            <Paperclip size={14} />
                        </button>

                        {input.length > 0 && !isBusy && (
                            <button
                                onClick={() => {
                                    if (input.trim()) {
                                        onSend(input);
                                        setInput('');
                                    }
                                }}
                                className="text-nexus-cyan hover:text-nexus-cyan/80 transition-colors"
                            >
                                <Send size={14} />
                            </button>
                        )}

                        {isBusy && (
                            <Loader2 size={14} className="animate-spin text-nexus-cyan" />
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-center mt-1.5 px-1">
                    <span className="text-[9px] text-gray-600">Enter to submit, Shift+Enter for newline</span>
                </div>
            </div>
        </div>
    );
};
