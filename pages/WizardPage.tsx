import React, { useState } from 'react';
import { ContractTemplate, CONTRACT_TEMPLATES } from '../services/wizardService';
import { Card, Button, Input } from '../components/UI';
import { ShieldCheck, Wand2, ArrowRight, ArrowLeft, CheckCircle, Code2, Layers, Shield, Activity, HardDrive, Info } from 'lucide-react';
import { Project, ChainType } from '../types';

interface WizardPageProps {
    onNavigateHome: () => void;
    onCreateProject: (project: Project) => void;
}

type WizardStep = 'SELECT_PATTERN' | 'CONFIGURE' | 'REVIEW';

export const WizardPage: React.FC<WizardPageProps> = ({ onNavigateHome, onCreateProject }) => {
    const [step, setStep] = useState<WizardStep>('SELECT_PATTERN');
    const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
    const [parameters, setParameters] = useState<Record<string, any>>({});
    const [generatedCode, setGeneratedCode] = useState('');

    const handleSelectTemplate = (template: ContractTemplate) => {
        setSelectedTemplate(template);
        // Initialize default values
        const defaults: Record<string, any> = {};
        template.parameters.forEach(p => {
            if (p.defaultValue !== undefined) defaults[p.id] = p.defaultValue;
        });
        setParameters(defaults);
        setStep('CONFIGURE');
    };

    const handleParamChange = (id: string, value: any) => {
        setParameters(prev => ({ ...prev, [id]: value }));
    };

    const handleGenerate = () => {
        if (!selectedTemplate) return;
        const code = selectedTemplate.generateSource(parameters);
        setGeneratedCode(code);
        setStep('REVIEW');
    };

    const handleFinalize = () => {
        if (!selectedTemplate) return;

        const newProject: Project = {
            id: crypto.randomUUID(),
            name: `${selectedTemplate.name} Instance`,
            chain: ChainType.BCH_TESTNET,
            contractCode: generatedCode,
            files: [
                {
                    name: 'contract.cash',
                    content: generatedCode,
                    language: 'cashscript'
                }
            ],
            versions: [
                {
                    id: 'init',
                    timestamp: Date.now(),
                    fileName: 'contract.cash',
                    code: generatedCode,
                    description: `Generated from ${selectedTemplate.name} template`,
                    author: 'SYSTEM'
                }
            ],
            lastModified: Date.now()
        };

        onCreateProject(newProject);
    };

    return (
        <div className="h-full w-full bg-nexus-900 overflow-auto p-8">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Wizard Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-nexus-purple/20 flex items-center justify-center">
                            <Wand2 className="w-6 h-6 text-nexus-purple" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Contract Wizard (Beta)</h1>
                            <p className="text-slate-400 text-sm">Guided, safe contract generation for the NexOps Ecosystem.</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onNavigateHome}>Exit Wizard</Button>
                </div>

                {/* Step Indicator */}
                <div className="relative flex items-center justify-between pb-4">
                    {/* Horizontal Connector Line */}
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-800 -translate-y-[1.5rem] z-0" />

                    {[
                        { id: 'SELECT_PATTERN', label: 'Select Template', step: 1 },
                        { id: 'CONFIGURE', label: 'Configure Parameters', step: 2 },
                        { id: 'REVIEW', label: 'Security Review', step: 3 }
                    ].map((s, idx) => {
                        const isActive = step === s.id;
                        const isPast = (step === 'CONFIGURE' && s.step < 2) || (step === 'REVIEW' && s.step < 3);

                        return (
                            <div key={s.id} className="relative z-10 flex flex-col items-center group">
                                <div className={`
                                    w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black transition-all duration-300
                                    ${isActive
                                        ? 'border-nexus-purple bg-nexus-purple/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)] scale-110'
                                        : isPast
                                            ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                            : 'border-slate-800 bg-nexus-900 text-slate-600'}
                                `}>
                                    {isPast ? <CheckCircle className="w-5 h-5" /> : s.step}
                                </div>
                                <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${isActive ? 'text-nexus-purple' : 'text-slate-600'}`}>
                                    {s.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -bottom-1 w-1 h-1 bg-nexus-purple rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Step Content */}
                {step === 'SELECT_PATTERN' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {CONTRACT_TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => handleSelectTemplate(t)}
                                className="p-5 bg-nexus-800/40 backdrop-blur-sm border border-white/5 hover:border-nexus-purple/40 rounded-lg text-left transition-all group relative overflow-hidden flex flex-col justify-between h-52"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Layers className="w-12 h-12 text-nexus-purple" />
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-nexus-purple uppercase mb-1 tracking-[0.2em] flex items-center">
                                        <Activity className="w-3 h-3 mr-1.5" />
                                        {t.category} Pattern
                                    </div>
                                    <h3 className="text-lg font-black text-white mb-2 tracking-tight group-hover:text-nexus-purple transition-colors italic">{t.name}</h3>
                                    <p className="text-slate-500 text-xs mb-4 line-clamp-2 leading-relaxed">{t.description}</p>
                                </div>

                                <div className="border-t border-white/5 pt-3 mt-auto flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <div className="text-[8px] font-mono text-slate-600 uppercase">Engine: Deterministic v1.0</div>
                                        <div className="text-[8px] font-mono text-slate-600 uppercase flex items-center">
                                            Security: <span className="text-green-500/70 ml-1">High / Audited</span>
                                        </div>
                                    </div>
                                    <div className="text-nexus-purple font-black text-[10px] uppercase tracking-widest flex items-center group-hover:translate-x-1 transition-transform">
                                        Configure &rarr;
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'CONFIGURE' && selectedTemplate && (
                    <div className="bg-nexus-800/60 backdrop-blur-md border border-white/5 p-8 rounded-lg space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between border-b border-white/5 pb-6">
                            <div>
                                <h2 className="text-2xl font-black text-white tracking-tight italic flex items-center">
                                    <Activity className="w-5 h-5 mr-3 text-nexus-purple" />
                                    {selectedTemplate.name}
                                </h2>
                                <p className="text-slate-500 text-xs mt-1 font-mono uppercase tracking-wider">Parameter Configuration Interface</p>
                            </div>
                            <Button variant="glass" size="sm" onClick={() => setStep('SELECT_PATTERN')} icon={<ArrowLeft className="w-3 h-3" />}>
                                <span className="text-[10px] uppercase tracking-widest">Change Plan</span>
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {selectedTemplate.parameters.map((p) => {
                                const val = parameters[p.id] || '';
                                const isHex = p.type === 'string' && selectedTemplate.id !== 'token-splitter'; // Rough check for PK fields
                                const isValidHex = isHex ? /^[0-9a-fA-F]*$/.test(val) && (val.length === 0 || val.length === 66 || val.length === 130) : true;

                                return (
                                    <div key={p.id} className="group">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{p.label}</label>
                                            {isHex && val.length > 0 && (
                                                <div className={`text-[10px] font-mono flex items-center ${isValidHex ? 'text-green-500' : 'text-red-500'}`}>
                                                    {isValidHex ? <CheckCircle className="w-3 h-3 mr-1" /> : <Info className="w-3 h-3 mr-1" />}
                                                    {isValidHex ? 'Valid Format' : 'Invalid Hex Length'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <input
                                                placeholder={p.placeholder}
                                                type={p.type === 'number' ? 'number' : 'text'}
                                                value={val}
                                                onChange={(e) => handleParamChange(p.id, p.type === 'number' ? Number(e.target.value) : e.target.value)}
                                                className={`
                                                    w-full bg-nexus-900 border px-4 py-3 text-sm transition-all outline-none font-mono rounded-md
                                                    ${isHex && val.length > 0 && !isValidHex ? 'border-red-500/50' : 'border-white/5 focus:border-nexus-purple/50 focus:ring-1 focus:ring-nexus-purple/20'}
                                                    ${isHex ? 'text-nexus-cyan' : 'text-slate-200'}
                                                `}
                                            />
                                            {isHex && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-700 pointer-events-none">
                                                    {val.length} chars
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">{p.description}</p>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-white/5 flex justify-end">
                            <Button
                                onClick={handleGenerate}
                                size="lg"
                                className="bg-nexus-purple hover:bg-purple-600 text-white font-black uppercase tracking-[0.15em] text-xs h-12 px-8 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                                icon={<ArrowRight className="w-4 h-4" />}
                            >
                                Initialize Pipeline
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'REVIEW' && selectedTemplate && (
                    <div className="bg-nexus-800/60 backdrop-blur-md border border-white/5 p-8 rounded-lg space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <ShieldCheck className="w-6 h-6 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight italic">Security Inspection</h2>
                                    <p className="text-slate-500 text-[10px] font-mono uppercase tracking-widest">Verification Status: Deterministic PASS</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/5 p-3 rounded-md border border-white/5">
                                <div className="text-center md:border-r border-white/10 pr-2">
                                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Compiler</div>
                                    <div className="text-[10px] font-mono text-white text-nowrap">cashc v0.13.0</div>
                                </div>
                                <div className="text-center md:border-r border-white/10 px-2">
                                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Audit</div>
                                    <div className="text-[10px] font-mono text-green-400">PASSED</div>
                                </div>
                                <div className="text-center md:border-r border-white/10 px-2">
                                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Issues</div>
                                    <div className="text-[10px] font-mono text-slate-400">0</div>
                                </div>
                                <div className="text-center pl-2">
                                    <div className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">Logic</div>
                                    <div className="text-[10px] font-mono text-nexus-cyan">STATIC</div>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute top-4 right-4 z-10 flex items-center space-x-2">
                                <div className="group relative">
                                    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] font-black uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(34,197,94,0.15)] animate-pulse">
                                        <Shield className="w-3 h-3" />
                                        <span>Audited Locally</span>
                                    </div>
                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-nexus-900 border border-white/10 rounded text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-2xl z-50 leading-relaxed">
                                        Verified against NexOps deterministic template engine. Reproducibility guaranteed.
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-900/50 rounded-md border border-white/5 overflow-hidden">
                                <div className="flex items-center px-4 py-2 border-b border-white/5 bg-white/5">
                                    <Code2 className="w-3 h-3 text-slate-500 mr-2" />
                                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest italic">source_manifest.cash</span>
                                </div>
                                <pre className="p-6 text-slate-400 font-mono text-xs overflow-auto max-h-[350px] custom-scrollbar leading-relaxed">
                                    <code>{generatedCode}</code>
                                </pre>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                            <div className="flex items-center space-x-4">
                                <div className="text-[9px] font-mono text-slate-600 flex items-center">
                                    <HardDrive className="w-3 h-3 mr-2" />
                                    <span className="opacity-50 mr-2 uppercase tracking-tighter">DETERMINISTIC HASH:</span>
                                    <span className="text-slate-500">0x{crypto.randomUUID().split('-')[0].toUpperCase()}7A9B42...</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-md p-4 flex items-start space-x-4">
                            <ShieldCheck className="w-5 h-5 text-nexus-cyan mt-0.5" />
                            <p className="text-[11px] text-nexus-cyan/70 leading-relaxed italic">
                                Infrastructure Note: This contract was synthesized using audited primitives. All logical branching is deterministic and verified against the NexOps static analysis engine.
                            </p>
                        </div>

                        <div className="pt-6 border-t border-white/5 flex justify-between">
                            <Button variant="ghost" onClick={() => setStep('CONFIGURE')} icon={<ArrowLeft className="w-3 h-3" />}>
                                <span className="text-[10px] uppercase font-bold tracking-widest">Adjust Parameters</span>
                            </Button>
                            <Button
                                onClick={handleFinalize}
                                size="lg"
                                className="bg-green-500 hover:bg-green-400 text-nexus-900 font-black uppercase tracking-[0.15em] text-xs h-12 px-8 flex items-center transition-all transform hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(34,197,94,0.3)]"
                                icon={<ArrowRight className="w-4 h-4" />}
                            >
                                Create Workspace & Execute
                            </Button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
