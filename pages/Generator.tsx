import React, { useState, useEffect } from 'react';
import { Card, Button, CodeBlock, DiffViewer } from '../components/UI';
import { generateSmartContract, fixSmartContract } from '../services/groqService';
import { Project, PageView, CodeVersion, ChainType } from '../types';
import { Sparkles, ArrowRight, Save, History, GitMerge, RotateCcw, Eye, Clock } from 'lucide-react';

interface GeneratorProps {
    activeProject: Project | null;
    onProjectCreate: (project: Project) => void;
    onProjectUpdate: (project: Project) => void;
    onNavigate: (view: PageView) => void;
}

export const Generator: React.FC<GeneratorProps> = ({ activeProject, onProjectCreate, onProjectUpdate, onNavigate }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [explanation, setExplanation] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Version Control State
    const [showHistory, setShowHistory] = useState(false);
    const [compareVersion, setCompareVersion] = useState<CodeVersion | null>(null);

    // Sync state with active project
    useEffect(() => {
        if (activeProject) {
            if (activeProject.isFixing && activeProject.fixInstructions) {
                setPrompt(`Applying security patches for: ${activeProject.name}\n\nIssues to fix:\n${activeProject.fixInstructions}`);
                setExplanation("Waiting to apply fixes based on Audit Report...");
                // Use current code as baseline
                setGeneratedCode(activeProject.contractCode);
            } else {
                // Normal load
                // Only set if we aren't already working on a draft
                if (!generatedCode) setGeneratedCode(activeProject.contractCode);
            }
        }
    }, [activeProject]);

    const handleAction = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        setCompareVersion(null); // Reset compare view on new generation

        try {
            if (activeProject?.isFixing) {
                // FIX MODE
                const result = await fixSmartContract(activeProject.contractCode, activeProject.fixInstructions || prompt);
                setGeneratedCode(result.code);
                setExplanation(result.explanation);
            } else {
                // GENERATE MODE
                const result = await generateSmartContract(prompt);
                setGeneratedCode(result.code);
                setExplanation(result.explanation);
            }
        } catch (e: any) {
            setError("Failed to process request. Please check your API Key and try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const createVersion = (code: string, desc: string, author: 'AI' | 'USER'): CodeVersion => ({
        id: Date.now().toString(),
        timestamp: Date.now(),
        code,
        description: desc,
        author
    });

    const handleSave = () => {
        // 1. Create a new Version Object
        const newVersion = createVersion(
            generatedCode,
            activeProject?.isFixing ? "Applied Security Fixes" : "Generated/Updated Contract",
            'AI'
        );

        if (activeProject) {
            // Update existing
            const updatedProject: Project = {
                ...activeProject,
                contractCode: generatedCode,
                versions: [newVersion, ...(activeProject.versions || [])], // Add to history
                isFixing: false,
                fixInstructions: undefined,
                lastModified: Date.now(),
                auditReport: undefined // Clear audit as code changed
            };
            onProjectUpdate(updatedProject);
            onNavigate(PageView.AUDITOR);
        } else {
            // Create New
            const newProject: Project = {
                id: Date.now().toString(),
                name: prompt.slice(0, 30) + (prompt.length > 30 ? '...' : ''),
                chain: ChainType.BCH_TESTNET,
                contractCode: generatedCode,
                files: [{ name: 'Contract.cash', content: generatedCode, language: 'cashscript' }],
                versions: [newVersion],
                lastModified: Date.now()
            };
            onProjectCreate(newProject);
            onNavigate(PageView.AUDITOR);
        }
    };

    const handleRollback = (version: CodeVersion) => {
        if (!confirm("Are you sure you want to rollback? Unsaved changes will be lost.")) return;
        setGeneratedCode(version.code);
        setCompareVersion(null);
        setExplanation(`Rolled back to version: ${version.description}`);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)]">

            {/* LEFT: Input Column (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col space-y-6 h-full">
                <Card className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white flex items-center">
                            {activeProject?.isFixing ? (
                                <>
                                    <GitMerge className="w-4 h-4 text-nexus-warning mr-2" />
                                    Security Patcher
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 text-nexus-cyan mr-2" />
                                    Generator Input
                                </>
                            )}
                        </h3>
                        <span className="text-xs text-nexus-cyan bg-nexus-cyan/10 px-2 py-1 rounded border border-nexus-cyan/20">
                            Groq LPU
                        </span>
                    </div>

                    <div className="flex-1 relative">
                        <textarea
                            className={`w-full h-full bg-nexus-900/50 text-gray-300 p-4 rounded-lg resize-none border focus:ring-1 outline-none font-sans ${activeProject?.isFixing
                                ? 'border-nexus-warning/50 focus:border-nexus-warning focus:ring-nexus-warning'
                                : 'border-nexus-700 focus:border-nexus-cyan focus:ring-nexus-cyan'
                                }`}
                            placeholder={activeProject?.isFixing ? "Review fix instructions..." : "Describe your CashScript (BCH) contract logic..."}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>

                    <div className="mt-6 flex justify-between items-center space-x-2">
                        <Button
                            onClick={handleAction}
                            isLoading={isGenerating}
                            disabled={!prompt}
                            variant={activeProject?.isFixing ? 'secondary' : 'primary'}
                            className={`flex-1 ${activeProject?.isFixing ? 'border-nexus-warning text-nexus-warning hover:text-white' : ''}`}
                            icon={activeProject?.isFixing ? <GitMerge className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        >
                            {activeProject?.isFixing ? "Apply Fixes" : "Generate"}
                        </Button>
                    </div>
                </Card>

                {explanation && (
                    <Card className="max-h-64 overflow-y-auto">
                        <h4 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">AI Summary</h4>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{explanation}</p>
                    </Card>
                )}
            </div>

            {/* RIGHT: Output & History (8 Cols) */}
            <div className={`lg:col-span-8 flex ${showHistory ? 'space-x-4' : ''} h-full overflow-hidden`}>

                {/* Code View Area */}
                <div className="flex-1 flex flex-col h-full space-y-4">
                    {generatedCode ? (
                        <>
                            {/* Toolbar */}
                            <div className="flex justify-between items-center bg-nexus-800 p-2 rounded-lg border border-nexus-700">
                                <div className="flex items-center space-x-2 px-2">
                                    <span className="text-xs font-mono text-gray-400">STATUS:</span>
                                    {compareVersion ? (
                                        <span className="text-xs text-orange-400 flex items-center">
                                            <GitMerge className="w-3 h-3 mr-1" /> COMPARING VERSIONS
                                        </span>
                                    ) : (
                                        <span className="text-xs text-nexus-cyan">DRAFT</span>
                                    )}
                                </div>
                                <div className="flex space-x-2">
                                    {activeProject && (
                                        <Button
                                            variant="ghost"
                                            onClick={() => setShowHistory(!showHistory)}
                                            className={`text-xs h-8 ${showHistory ? 'bg-nexus-700 text-white' : ''}`}
                                            icon={<History className="w-3 h-3" />}
                                        >
                                            History
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Editor / Diff Viewer */}
                            <div className="flex-1 overflow-hidden">
                                {compareVersion ? (
                                    <DiffViewer oldCode={compareVersion.code} newCode={generatedCode} />
                                ) : (
                                    <CodeBlock code={generatedCode} />
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex space-x-4">
                                <Button onClick={handleSave} className="flex-1" icon={<Save className="w-4 h-4" />}>
                                    {activeProject?.isFixing ? "Commit Fixes & Re-Audit" : "Save Version & Audit"}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <Card className="flex-1 flex flex-col items-center justify-center text-center border-dashed border-2 border-nexus-700 bg-transparent">
                            {error ? (
                                <div className="text-nexus-danger">
                                    <p className="font-bold">Error</p>
                                    <p className="text-sm mt-2">{error}</p>
                                </div>
                            ) : (
                                <div className="text-gray-500">
                                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="font-medium">Ready</p>
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                {/* History Sidebar */}
                {showHistory && activeProject && (
                    <div className="w-64 flex-shrink-0 flex flex-col bg-nexus-800/50 border-l border-nexus-700 h-full animate-in slide-in-from-right-10 duration-200">
                        <div className="p-3 border-b border-nexus-700 font-bold text-sm text-gray-300 flex items-center">
                            <History className="w-4 h-4 mr-2" /> Version History
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                            {activeProject.versions?.map((v, i) => (
                                <div
                                    key={v.id}
                                    className={`p-3 rounded border text-left transition-all ${compareVersion?.id === v.id
                                        ? 'bg-orange-900/20 border-orange-500/50'
                                        : 'bg-nexus-900 border-nexus-700 hover:border-nexus-cyan/50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-white">v{activeProject.versions.length - i}</span>
                                        <span className="text-[10px] text-gray-500">{new Date(v.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2 truncate" title={v.description}>{v.description}</p>

                                    <div className="flex space-x-1 mt-2">
                                        <button
                                            onClick={() => setCompareVersion(compareVersion?.id === v.id ? null : v)}
                                            className="flex-1 flex items-center justify-center py-1 bg-nexus-800 hover:bg-nexus-700 rounded text-[10px] text-gray-300 border border-nexus-700"
                                            title="Compare with current"
                                        >
                                            <Eye className="w-3 h-3 mr-1" /> Diff
                                        </button>
                                        <button
                                            onClick={() => handleRollback(v)}
                                            className="flex-1 flex items-center justify-center py-1 bg-nexus-800 hover:bg-red-900/30 rounded text-[10px] text-gray-300 hover:text-red-400 border border-nexus-700"
                                            title="Rollback to this version"
                                        >
                                            <RotateCcw className="w-3 h-3 mr-1" /> Revert
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(!activeProject.versions || activeProject.versions.length === 0) && (
                                <div className="text-center text-xs text-gray-500 py-4">No history yet</div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};