import React, { useState } from 'react';
import {
    FileJson, Code, Cpu, Layers,
    Copy, Check, Download, ExternalLink,
    Terminal as TerminalIcon, Info, Zap
} from 'lucide-react';
import { Button, Badge } from './UI';

interface ArtifactInspectorProps {
    artifact: {
        contractName: string;
        constructorInputs: any[];
        abi: any[];
        bytecode: string;
        source?: string;
        compiler?: {
            name: string;
            version: string;
        };
    };
    onDeploy?: () => void;
}

export const ArtifactInspector: React.FC<ArtifactInspectorProps> = ({ artifact, onDeploy }) => {
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'METADATA' | 'ABI' | 'BYTECODE'>('METADATA');

    const handleCopyBytecode = () => {
        navigator.clipboard.writeText(artifact.bytecode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const downloadArtifact = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(artifact, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${artifact.contractName}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const bytecodeSize = artifact.bytecode.length / 2;

    return (
        <div className="h-full flex flex-col bg-[#0a0a0c] text-slate-300 font-sans overflow-hidden">
            {/* Header Area */}
            <div className="p-6 bg-gradient-to-br from-nexus-cyan/10 to-transparent border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                            <FileJson className="text-yellow-500" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">{artifact.contractName}</h2>
                            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">Compiled Artifact</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="glass" size="sm" onClick={downloadArtifact} icon={<Download size={14} />}>
                            Export
                        </Button>
                        <Button variant="primary" size="sm" onClick={onDeploy} icon={<Zap size={14} />}>
                            Deploy
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                    <button
                        onClick={() => setActiveTab('METADATA')}
                        className={`flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'METADATA' ? 'border-nexus-cyan text-nexus-cyan' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Info size={14} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('ABI')}
                        className={`flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'ABI' ? 'border-nexus-cyan text-nexus-cyan' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Layers size={14} /> Interface (ABI)
                    </button>
                    <button
                        onClick={() => setActiveTab('BYTECODE')}
                        className={`flex items-center gap-2 pb-2 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'BYTECODE' ? 'border-nexus-cyan text-nexus-cyan' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Cpu size={14} /> Bytecode
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                {activeTab === 'METADATA' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Statistics</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                        <p className="text-[10px] text-slate-500 mb-1">Size</p>
                                        <p className="text-lg font-mono text-white leading-none">{bytecodeSize} <span className="text-[10px]">bytes</span></p>
                                    </div>
                                    <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                        <p className="text-[10px] text-slate-500 mb-1">Functions</p>
                                        <p className="text-lg font-mono text-white leading-none">{artifact.abi.length}</p>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Constructor</h3>
                                <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                    {artifact.constructorInputs.length > 0 ? (
                                        <div className="space-y-3">
                                            {artifact.constructorInputs.map((input, idx) => (
                                                <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                                    <span className="text-xs font-mono text-cyan-400">{input.name}</span>
                                                    <Badge variant="info">{input.type}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-500 italic">No constructor arguments required.</p>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="space-y-6">
                            <section>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Compiler</h3>
                                <div className="bg-white/5 rounded-lg p-4 border border-white/5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-400">Name</span>
                                        <span className="text-xs font-bold text-white">{artifact.compiler?.name || 'cashc'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">Version</span>
                                        <Badge variant="success">{artifact.compiler?.version || '0.13.0'}</Badge>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Target Network</h3>
                                <div className="bg-white/5 rounded-lg p-4 border border-white/5 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">Default</span>
                                    <span className="text-xs font-bold text-nexus-cyan">CHIPNET</span>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {activeTab === 'ABI' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Function Signatures</h3>
                            <span className="text-[10px] text-slate-500">Note: Parameters are required in order.</span>
                        </div>
                        {artifact.abi.map((fn, idx) => (
                            <div key={fn.name} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-nexus-cyan/30 transition-all group">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-nexus-cyan shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
                                        <h4 className="text-sm font-bold text-white group-hover:text-nexus-cyan transition-colors">{fn.name}</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                        <Badge variant="low">METHOD ID: {idx}</Badge>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-black/40 rounded-lg p-3">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Arguments</p>
                                        <div className="space-y-2">
                                            {fn.inputs.length > 0 ? fn.inputs.map((input: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-400">{input.name}</span>
                                                    <span className="font-mono text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded border border-purple-400/20">{input.type}</span>
                                                </div>
                                            )) : (
                                                <p className="text-[10px] text-slate-600 italic">No arguments</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-black/40 rounded-lg p-3">
                                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2 font-bold">Raw Reference</p>
                                        <p className="text-[10px] font-mono text-slate-400 line-clamp-2">
                                            {fn.name}({fn.inputs.map((inpt: any) => inpt.type).join(', ')})
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'BYTECODE' && (
                    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Compiled Bytecode</h3>
                            <button
                                onClick={handleCopyBytecode}
                                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-nexus-cyan hover:text-cyan-300 transition-colors"
                            >
                                {copied ? <Check size={12} /> : <Copy size={12} />}
                                {copied ? 'Copied' : 'Copy Hex'}
                            </button>
                        </div>
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/10 p-4 font-mono text-xs leading-relaxed overflow-auto custom-scrollbar break-all text-slate-400">
                            <span className="text-white select-all">{artifact.bytecode}</span>
                        </div>
                        <div className="mt-4 p-4 bg-nexus-cyan/5 rounded-lg border border-nexus-cyan/20">
                            <div className="flex items-start gap-3">
                                <TerminalIcon className="text-nexus-cyan shrink-0 mt-0.5" size={16} />
                                <div>
                                    <p className="text-[10px] font-bold text-white uppercase tracking-wider mb-1">Execution Insight</p>
                                    <p className="text-[10px] text-slate-400 leading-normal">
                                        This bytecode represents the state-locked locking script of the contract. When a transaction attempts to spend from this address, the Bitcoin Cash virtual machine (BVM) will execute these opcodes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
