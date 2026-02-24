import React, { useState, useEffect } from 'react';
import { Card, Button, CodeBlock, Badge, DiffViewer } from '../components/UI';
import { TransactionBuilder } from '../components/TransactionBuilder';
import { auditSmartContract, fixSmartContract } from '../services/groqService';
import { compileCashScript } from '../services/compilerService';
import { Project, AuditReport, ChainType } from '../types';
import { ShieldCheck, CheckCircle, ArrowRight, Play, RefreshCcw, GitCompare, FileCode, History, Terminal } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface AuditorProps {
    project: Project | null;
    wcSession: any;
    constructorArgs: string[];
    deployedAddress: string;
    deployedArtifact: any;
    onUpdateProject: (p: Project) => void;
    onRequestFix: (project: Project, report: AuditReport) => void;
    onCreateProject: (project: Project) => void;
}

export const Auditor: React.FC<AuditorProps> = ({
    project,
    wcSession,
    constructorArgs,
    deployedAddress,
    deployedArtifact,
    onUpdateProject,
    onRequestFix,
    onCreateProject
}) => {
    const [isAuditing, setIsAuditing] = useState(false);
    const [localCode, setLocalCode] = useState(project?.contractCode || '');
    const [report, setReport] = useState<AuditReport | null>(project?.auditReport || null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'AUDIT' | 'INTERACT'>('AUDIT');

    // Diff View State
    const [viewMode, setViewMode] = useState<'EDIT' | 'DIFF'>('EDIT');
    const [diffBaseId, setDiffBaseId] = useState<string>('');
    const [diffTargetId, setDiffTargetId] = useState<string>('');

    // Sync local code if project changes and setup diff defaults
    useEffect(() => {
        if (project) {
            setLocalCode(project.contractCode);
            setReport(project.auditReport || null);

            // Setup default diff versions if available
            if (project.versions && project.versions.length > 1) {
                setDiffTargetId(project.versions[0].id); // Latest
                setDiffBaseId(project.versions[1].id);   // Previous
            } else if (project.versions && project.versions.length === 1) {
                setDiffTargetId(project.versions[0].id);
                setDiffBaseId(project.versions[0].id);
            }
        } else {
            setLocalCode('');
            setReport(null);
        }
    }, [project]);

    // Setup interaction mode if deployed
    useEffect(() => {
        if (deployedAddress && deployedArtifact) {
            setActiveTab('INTERACT');
        }
    }, [deployedAddress, deployedArtifact]);

    const handleAudit = async () => {
        if (!localCode.trim()) {
            setError("Please enter some CashScript code.");
            return;
        }

        setIsAuditing(true);
        setError(null);
        setReport(null); // Clear previous report

        try {
            // STEP 1: COMPILATION GATE
            const compilation = compileCashScript(localCode);

            if (!compilation.success) {
                const compilerReport: AuditReport = {
                    score: 0,
                    summary: "❌ COMPILATION FAILED: The code is invalid and cannot be compiled.",
                    vulnerabilities: compilation.errors.map((err, i) => ({
                        severity: "HIGH",
                        title: "Compiler Error [CRITICAL]",
                        description: err,
                        recommendation: "Fix the syntax error reported by the compiler.",
                        line: 0
                    })),
                    timestamp: Date.now()
                };
                setReport(compilerReport);
                setIsAuditing(false);
                return;
            }

            // STEP 2: AI AUDIT
            const result = await auditSmartContract(localCode);
            setReport(result);

            if (project) {
                onUpdateProject({ ...project, contractCode: localCode, auditReport: result });
            } else {
                const newProject: Project = {
                    id: Date.now().toString(),
                    name: `Manual Audit ${new Date().toLocaleTimeString()} `,
                    chain: ChainType.BCH_TESTNET,
                    contractCode: localCode,
                    files: [{ name: 'AuditedContract.cash', content: localCode, language: 'cashscript' }],
                    versions: [{
                        id: Date.now().toString(),
                        timestamp: Date.now(),
                        fileName: 'AuditedContract.cash',
                        code: localCode,
                        description: "Initial Manual Audit",
                        author: 'USER'
                    }],
                    lastModified: Date.now(),
                    auditReport: result
                };
                onCreateProject(newProject);
            }
        } catch (e) {
            setError("Audit failed. Check API Key or connectivity.");
        } finally {
            setIsAuditing(false);
        }
    };

    const handleFix = () => {
        if (project && report) {
            onRequestFix(project, report);
        }
    };

    const scoreColor = (score: number) => {
        if (score >= 80) return '#10B981';
        if (score >= 50) return '#F59E0B';
        return '#EF4444';
    };

    const chartData = report ? [
        { name: 'Score', value: report.score },
        { name: 'Deficit', value: 100 - report.score },
    ] : [];

    const isEditable = !isAuditing;
    const hasHistory = project?.versions && project.versions.length > 1;

    // Helper to get code for selected diff versions
    const getVersionCode = (id: string) => {
        return project?.versions?.find(v => v.id === id)?.code || '';
    };

    return (
        <div className="flex flex-col h-full gap-4">

            {/* Mode Switcher */}
            <div className="flex justify-center mb-2">
                <div className="flex bg-nexus-900 border border-nexus-700 rounded-lg p-1">
                    <button
                        onClick={() => setActiveTab('AUDIT')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center ${activeTab === 'AUDIT'
                            ? 'bg-nexus-cyan text-black shadow-lg shadow-nexus-cyan/20'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <ShieldCheck className="w-4 h-4 mr-2" /> Auditor
                    </button>
                    <button
                        onClick={() => setActiveTab('INTERACT')}
                        disabled={!deployedAddress}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center ${activeTab === 'INTERACT'
                            ? 'bg-nexus-blue text-white shadow-lg shadow-nexus-blue/20'
                            : 'text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        title={!deployedAddress ? "Deploy contract first" : "Interact with smart contract"}
                    >
                        <Terminal className="w-4 h-4 mr-2" /> Interact
                    </button>
                </div>
            </div>

            {/* INTERACTION MODE */}
            {activeTab === 'INTERACT' && deployedArtifact ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TransactionBuilder
                        artifact={deployedArtifact}
                        deployedAddress={deployedAddress}
                        constructorArgs={constructorArgs}
                        wcSession={wcSession}
                    />
                </div>
            ) : (

                /* AUDIT MODE */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                    {/* Code Editor / Diff Viewer */}
                    <div className="lg:col-span-7 flex flex-col h-full">
                        <Card className="flex-1 flex flex-col p-0 overflow-hidden border-nexus-700 bg-nexus-900/50">
                            <div className="flex justify-between items-center p-3 border-b border-nexus-700 bg-nexus-800/50">
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <span className="font-mono text-nexus-cyan font-bold text-sm">
                                            {project ? project.name : "Manual Code Input"}
                                        </span>
                                        {!project && <span className="text-xs text-gray-500">(Paste your code below)</span>}
                                    </div>
                                    {hasHistory && (
                                        <div className="flex bg-nexus-900 rounded-lg p-1 border border-nexus-700">
                                            <button onClick={() => setViewMode('EDIT')} className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-all ${viewMode === 'EDIT' ? 'bg-nexus-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                                                <FileCode className="w-3 h-3 mr-1.5" /> Editor
                                            </button>
                                            <button onClick={() => setViewMode('DIFF')} className={`flex items-center px-3 py-1 rounded text-xs font-medium transition-all ${viewMode === 'DIFF' ? 'bg-nexus-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}>
                                                <GitCompare className="w-3 h-3 mr-1.5" /> Compare Changes
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 font-mono">
                                    {viewMode === 'EDIT' ? `${localCode.length} chars` : 'Diff Mode'}
                                </div>
                            </div>

                            {viewMode === 'DIFF' && hasHistory ? (
                                <div className="flex flex-col h-full">
                                    <div className="flex items-center justify-between bg-nexus-900 border-b border-nexus-700 p-2 px-4 space-x-4">
                                        <div className="flex-1 flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">Previous</label>
                                            <select value={diffBaseId} onChange={(e) => setDiffBaseId(e.target.value)} className="bg-nexus-800 text-xs text-gray-300 border border-nexus-700 rounded p-1">
                                                {project.versions.map((v, i) => (
                                                    <option key={v.id} value={v.id}>v{project.versions.length - i}: {v.description.substring(0, 20)}...</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="text-gray-500 pt-3"><ArrowRight className="w-4 h-4" /></div>
                                        <div className="flex-1 flex flex-col">
                                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current</label>
                                            <select value={diffTargetId} onChange={(e) => setDiffTargetId(e.target.value)} className="bg-nexus-800 text-xs text-gray-300 border border-nexus-700 rounded p-1">
                                                {project.versions.map((v, i) => (
                                                    <option key={v.id} value={v.id}>v{project.versions.length - i}: {v.description.substring(0, 20)}...</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative overflow-hidden">
                                        <DiffViewer oldCode={getVersionCode(diffBaseId)} newCode={getVersionCode(diffTargetId)} />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 p-2 bg-nexus-900">
                                    <CodeBlock code={localCode} editable={isEditable} onChange={setLocalCode} />
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Audit Control & Results */}
                    <div className="lg:col-span-5 flex flex-col h-full space-y-4 overflow-y-auto">
                        <Card className="flex-shrink-0">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-white flex items-center">
                                    <ShieldCheck className="w-5 h-5 mr-2 text-nexus-cyan" /> Audit Control
                                </h3>
                            </div>
                            <p className="text-sm text-gray-400 mb-4">
                                {project ? "Analyzing project codebase." : "Paste external code to audit."}
                            </p>
                            {error && <div className="p-2 mb-4 text-xs bg-red-900/20 text-red-400 border border-red-800 rounded">{error}</div>}
                            <Button onClick={handleAudit} isLoading={isAuditing} className="w-full" icon={<Play className="w-4 h-4" />}>
                                {report ? "Re-Run Audit" : "Start Security Scan"}
                            </Button>
                        </Card>

                        {report && (
                            <Card className="flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-4 border-b border-nexus-700 pb-4">
                                    <div>
                                        <p className="text-gray-400 text-xs uppercase tracking-wider">Security Score</p>
                                        <h2 className="text-4xl font-bold" style={{ color: scoreColor(report.score) }}>{report.score}/100</h2>
                                    </div>
                                    <div className="w-16 h-16">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={chartData} innerRadius={20} outerRadius={30} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                                                    <Cell fill={scoreColor(report.score)} />
                                                    <Cell fill="#1F2937" />
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                                    <div className="bg-nexus-800/50 p-3 rounded text-sm text-gray-300 italic border-l-2 border-nexus-cyan">
                                        {report.summary}
                                    </div>

                                    {report.vulnerabilities.length === 0 && (
                                        <div className="text-center py-8 text-green-400">
                                            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No Critical Vulnerabilities Found</p>
                                        </div>
                                    )}

                                    {report.vulnerabilities.map((vuln, idx) => (
                                        <div key={idx} className="bg-nexus-900/30 border border-nexus-700 p-3 rounded hover:border-nexus-danger/30 transition-colors text-left group">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-gray-200 text-sm">{vuln.title}</span>
                                                <Badge variant={vuln.severity.toLowerCase() as any}>{vuln.severity}</Badge>
                                            </div>
                                            <p className="text-xs text-gray-400 mb-2">{vuln.description}</p>
                                            <div className="text-xs bg-nexus-800 p-2 rounded text-nexus-cyan font-mono border border-nexus-700/50">
                                                FIX: {vuln.recommendation}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 pt-4 border-t border-nexus-700 flex space-x-3">
                                    {report.score < 80 ? (
                                        <Button variant="secondary" className="flex-1 border-nexus-danger text-red-400 hover:bg-red-900/20" icon={<RefreshCcw className="w-4 h-4" />} onClick={handleFix}>
                                            Auto-Fix with AI
                                        </Button>
                                    ) : null}
                                </div>
                            </Card>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};