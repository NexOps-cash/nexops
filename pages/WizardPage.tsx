import React, { useState } from 'react';
import { ContractTemplate, CONTRACT_TEMPLATES } from '../services/wizardService';
import { Card, Button, Input } from '../components/UI';
import { ShieldCheck, Wand2, ArrowRight, ArrowLeft, CheckCircle, Code2, Layers } from 'lucide-react';
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
                            <h1 className="text-3xl font-black text-white tracking-tight">Contract Wizard</h1>
                            <p className="text-slate-400 text-sm">Guided, safe contract generation for the NexOps Ecosystem.</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onNavigateHome}>Exit Wizard</Button>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center space-x-4 pb-8 border-b border-slate-800">
                    <div className={`flex items-center space-x-2 ${step === 'SELECT_PATTERN' ? 'text-nexus-purple' : 'text-slate-500'}`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${step === 'SELECT_PATTERN' ? 'border-nexus-purple' : 'border-slate-700'}`}>1</span>
                        <span className="font-bold">Select Template</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-700" />
                    <div className={`flex items-center space-x-2 ${step === 'CONFIGURE' ? 'text-nexus-purple' : 'text-slate-500'}`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${step === 'CONFIGURE' ? 'border-nexus-purple' : 'border-slate-700'}`}>2</span>
                        <span className="font-bold">Configure</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-700" />
                    <div className={`flex items-center space-x-2 ${step === 'REVIEW' ? 'text-nexus-purple' : 'text-slate-500'}`}>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${step === 'REVIEW' ? 'border-nexus-purple' : 'border-slate-700'}`}>3</span>
                        <span className="font-bold">Review</span>
                    </div>
                </div>

                {/* Step Content */}
                {step === 'SELECT_PATTERN' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        {CONTRACT_TEMPLATES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => handleSelectTemplate(t)}
                                className="p-6 bg-nexus-800 border-2 border-slate-700 hover:border-nexus-purple rounded-xl text-left transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Layers className="w-16 h-16" />
                                </div>
                                <div className="text-xs font-bold text-nexus-purple uppercase mb-2 tracking-wider">{t.category}</div>
                                <h3 className="text-xl font-bold text-white mb-2">{t.name}</h3>
                                <p className="text-slate-400 text-sm mb-6 line-clamp-2">{t.description}</p>
                                <div className="text-nexus-purple font-semibold text-xs flex items-center">
                                    Configure Parameters &rarr;
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {step === 'CONFIGURE' && selectedTemplate && (
                    <Card className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-2">
                            <div>
                                <h2 className="text-2xl font-bold text-white">{selectedTemplate.name}</h2>
                                <p className="text-slate-400 text-sm">{selectedTemplate.description}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setStep('SELECT_PATTERN')} icon={<ArrowLeft className="w-4 h-4" />}>Change Template</Button>
                        </div>

                        <div className="space-y-6">
                            {selectedTemplate.parameters.map((p) => (
                                <div key={p.id}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">{p.label}</label>
                                    <Input
                                        placeholder={p.placeholder}
                                        type={p.type === 'number' ? 'number' : 'text'}
                                        value={parameters[p.id] || ''}
                                        onChange={(e) => handleParamChange(p.id, p.type === 'number' ? Number(e.target.value) : e.target.value)}
                                        className="bg-nexus-900 border-slate-700"
                                    />
                                    <p className="text-xs text-slate-500 mt-2">{p.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="pt-8 border-t border-slate-800 flex justify-end">
                            <Button
                                onClick={handleGenerate}
                                size="lg"
                                icon={<ArrowRight className="w-4 h-4" />}
                                className="bg-nexus-purple hover:bg-purple-600"
                            >
                                Preview Contract
                            </Button>
                        </div>
                    </Card>
                )}

                {step === 'REVIEW' && selectedTemplate && (
                    <Card className="p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                            <div className="flex items-center space-x-3">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                                <div>
                                    <h2 className="text-2xl font-bold text-white">Review Generated Contract</h2>
                                    <p className="text-slate-400 text-sm">Deterministic generation successful. Review your contract below.</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative group">
                            <div className="absolute top-4 right-4 z-10">
                                <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-400/20 px-2 py-1 rounded-full uppercase tracking-widest">Audited Locally</span>
                            </div>
                            <pre className="p-6 bg-nexus-900 border border-slate-700 rounded-xl text-slate-300 font-mono text-sm overflow-auto max-h-[400px]">
                                <code>{generatedCode}</code>
                            </pre>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start space-x-4">
                            <ShieldCheck className="w-5 h-5 text-blue-400 mt-0.5" />
                            <p className="text-xs text-blue-100/80 leading-relaxed italic">
                                Note: This contract was generated using audited, deterministic logic. Pure LLM generation was bypassed to ensure safety and logical predictability.
                            </p>
                        </div>

                        <div className="pt-8 border-t border-slate-800 flex justify-between">
                            <Button variant="ghost" onClick={() => setStep('CONFIGURE')} icon={<ArrowLeft className="w-4 h-4" />}>Back to Params</Button>
                            <Button
                                onClick={handleFinalize}
                                size="lg"
                                icon={<Code2 className="w-4 h-4" />}
                                className="bg-green-600 hover:bg-green-500"
                            >
                                Create Workspace & Go
                            </Button>
                        </div>
                    </Card>
                )}

            </div>
        </div>
    );
};
