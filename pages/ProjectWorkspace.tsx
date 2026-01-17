
import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, CodeBlock, DiffViewer, Tabs, getFileIcon, Badge } from '../components/UI';
import { Project, ProjectFile, PageView, CodeVersion } from '../types';
import {
    Folder, Save, Play, ShieldCheck, History, Rocket,
    Download, Settings, FilePlus, ChevronRight, ChevronDown,
    AlertTriangle, CheckCircle, Copy, GitMerge, RotateCcw,
    FileJson, MessageSquare, Send, User, Bot, Wand2, X,
    FileCode
} from 'lucide-react';
import { auditSmartContract, fixSmartContract, chatWithAssistant } from '../services/groqService';
import { Deployment } from './Deployment';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    fileUpdates?: { name: string, content: string }[];
    isApplied?: boolean;
}

interface ProjectWorkspaceProps {
    project: Project;
    onUpdateProject: (p: Project) => void;
    onNavigate: (view: PageView) => void;
    walletConnected: boolean;
    onConnectWallet: () => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onUpdateProject, onNavigate, walletConnected, onConnectWallet }) => {
    // -- State --
    const [activeFileName, setActiveFileName] = useState<string>(project.files[0]?.name || '');
    const [activeTab, setActiveTab] = useState('ASSISTANT');
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    // Tools State
    const [isAuditing, setIsAuditing] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentLog, setDeploymentLog] = useState<string[]>([]);

    // Assistant State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Version State
    const [compareVersion, setCompareVersion] = useState<CodeVersion | null>(null);

    // Derived State
    const activeFile = project.files.find(f => f.name === activeFileName);
    const mainContractFile = project.files.find(f => f.name.endsWith('.cash'));

    // Fix: Deduplicate files reliably for UI rendering
    const uniqueFiles = project.files.reduce((acc: ProjectFile[], current) => {
        const x = acc.find(item => item.name === current.name);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    // Sync active file if it becomes missing
    useEffect(() => {
        if (!project.files.find(f => f.name === activeFileName)) {
            setActiveFileName(project.files[0]?.name || '');
        }
    }, [project.files, activeFileName]);

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // -- Handlers --

    const handleFileChange = (newContent: string) => {
        const updatedFiles = project.files.map(f =>
            f.name === activeFileName ? { ...f, content: newContent } : f
        );
        const updatedProject = {
            ...project,
            files: updatedFiles,
            lastModified: Date.now()
        };

        if (mainContractFile?.name === activeFileName) {
            updatedProject.contractCode = newContent;
        }

        setUnsavedChanges(true);
        onUpdateProject(updatedProject);
    };

    const handleSave = (description: string = `Snapshot: ${new Date().toLocaleTimeString()}`) => {
        if (!mainContractFile) return;

        const newVersion: CodeVersion = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            code: mainContractFile.content,
            description,
            author: 'USER'
        };

        onUpdateProject({
            ...project,
            versions: [newVersion, ...project.versions],
            lastModified: Date.now()
        });
        setUnsavedChanges(false);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || isChatting) return;

        const userMsg = chatInput;
        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setIsChatting(true);

        try {
            const result = await chatWithAssistant(userMsg, project.files, chatHistory);
            setChatHistory(prev => [...prev, {
                role: 'model',
                text: result.response,
                fileUpdates: result.fileUpdates
            }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Assistant error. Verify protocol connection." }]);
        } finally {
            setIsChatting(false);
        }
    };

    const applyFileUpdates = (updates: { name: string, content: string }[], messageIndex: number) => {
        // Deep clone files
        const updatedFiles = [...project.files];

        updates.forEach(update => {
            const existingIndex = updatedFiles.findIndex(f => f.name === update.name);
            if (existingIndex !== -1) {
                updatedFiles[existingIndex] = { ...updatedFiles[existingIndex], content: update.content };
            } else {
                updatedFiles.push({
                    name: update.name,
                    content: update.content,
                    language: update.name.endsWith('.cash') ? 'cashscript' : 'markdown'
                });
            }
        });

        // Set the primary updated file as active
        if (updates.length > 0) {
            setActiveFileName(updates[0].name);
        }

        const mainUpdate = updates.find(u => u.name.endsWith('.cash'));

        const newVersion: CodeVersion = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            code: mainUpdate ? mainUpdate.content : (mainContractFile?.content || ''),
            description: 'AI Protocol Update applied',
            author: 'AI'
        };

        // Update local chat history to show it's applied
        const newHistory = [...chatHistory];
        newHistory[messageIndex] = { ...newHistory[messageIndex], isApplied: true };
        setChatHistory(newHistory);

        // Commit to parent state (triggers App's useEffect localStorage sync)
        onUpdateProject({
            ...project,
            files: updatedFiles,
            contractCode: newVersion.code,
            versions: [newVersion, ...project.versions],
            lastModified: Date.now()
        });

        setUnsavedChanges(false);
    };

    const handleRunAudit = async () => {
        if (!mainContractFile) return;
        setIsAuditing(true);
        try {
            const report = await auditSmartContract(mainContractFile.content);
            onUpdateProject({ ...project, auditReport: report });
        } catch (e) {
            console.error(e);
        } finally {
            setIsAuditing(false);
        }
    };

    const handleAutoFix = async () => {
        if (!mainContractFile || !project.auditReport) return;

        setIsAuditing(true);
        const instructions = project.auditReport.vulnerabilities.map(v => `${v.title}: ${v.fixSuggestion}`).join('\n');
        try {
            const result = await fixSmartContract(mainContractFile.content, instructions);

            const newVersion: CodeVersion = {
                id: Date.now().toString(),
                timestamp: Date.now(),
                code: result.code,
                description: 'Nex Auditor Auto-Fix Applied',
                author: 'AI'
            };

            const updatedFiles = project.files.map(f =>
                f.name === mainContractFile.name ? { ...f, content: result.code } : f
            );

            onUpdateProject({
                ...project,
                files: updatedFiles,
                contractCode: result.code,
                versions: [newVersion, ...project.versions],
                auditReport: undefined,
                lastModified: Date.now()
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsAuditing(false);
        }
    };

    const handleDeploy = () => {
        if (!project.auditReport || project.auditReport.score < 80) return;
        setIsDeploying(true);
        setDeploymentLog(['Initializing NexOps broadcast engine...']);

        setTimeout(() => setDeploymentLog(p => [...p, 'Compiling CashScript to Bytecode...']), 1000);
        setTimeout(() => setDeploymentLog(p => [...p, 'Requesting provider signature...']), 2500);
        setTimeout(() => {
            setDeploymentLog(p => [...p, `Broadcasting to Chipnet!`, 'Transaction ID: 0x8a...f29b']);
            setIsDeploying(false);
        }, 4000);
    };

    const handleRevert = (v: CodeVersion) => {
        if (!mainContractFile) return;
        const updatedFiles = project.files.map(f =>
            f.name === mainContractFile.name ? { ...f, content: v.code } : f
        );
        onUpdateProject({
            ...project,
            files: updatedFiles,
            contractCode: v.code,
            lastModified: Date.now()
        });
        setCompareVersion(null);
    };

    // -- Render --

    return (
        <div className="h-full flex gap-0 overflow-hidden relative bg-nexus-900">

            {/* Explorer (Left) */}
            <aside className="w-64 flex flex-shrink-0 flex-col border-r border-slate-800/50 bg-nexus-800">
                <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Folder size={16} className="text-slate-500" />
                        <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{project.name}</span>
                    </div>
                    <button className="text-slate-500 hover:text-nexus-cyan transition-colors">
                        <FilePlus size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar py-2">
                    <div className="px-4 mb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Filesystem</span>
                    </div>
                    <div className="space-y-px">
                        {uniqueFiles.map(file => (
                            <button
                                key={file.name}
                                onClick={() => setActiveFileName(file.name)}
                                className={`w-full flex items-center space-x-3 px-4 py-2 text-xs transition-all relative truncate ${activeFileName === file.name
                                    ? 'text-white bg-nexus-cyan/10 font-bold'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                            >
                                {activeFileName === file.name && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-nexus-cyan"></div>}
                                <div className="flex-shrink-0">{getFileIcon(file.name)}</div>
                                <span className="truncate">{file.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-nexus-900/50 border-t border-slate-800/50">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Protocol</span>
                        <Badge variant="info">{project.chain.split(' ')[0]}</Badge>
                    </div>
                </div>
            </aside>

            {/* Editor (Center) */}
            <div className="flex-1 flex flex-col min-w-0 bg-nexus-900">
                {/* File Tabs */}
                <div className="h-10 flex items-center bg-nexus-800/40 border-b border-slate-800/50 px-1 overflow-x-auto no-scrollbar">
                    {uniqueFiles.map(file => (
                        <button
                            key={file.name}
                            onClick={() => setActiveFileName(file.name)}
                            className={`flex items-center space-x-2 px-4 h-full text-[11px] font-bold transition-all border-b-2 ${activeFileName === file.name
                                ? 'border-nexus-cyan bg-nexus-900 text-white'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            <span className="truncate">{file.name}</span>
                            {unsavedChanges && activeFileName === file.name && <div className="w-1.5 h-1.5 rounded-full bg-nexus-warning animate-pulse"></div>}
                        </button>
                    ))}
                </div>

                {/* Main Editor Surface */}
                <div className="flex-1 relative overflow-hidden flex flex-col">
                    <div className="flex-1 relative">
                        {compareVersion && activeFile ? (
                            <DiffViewer oldCode={compareVersion.code} newCode={activeFile.content} />
                        ) : activeFile ? (
                            <CodeBlock
                                code={activeFile.content}
                                editable={!activeFile.readOnly}
                                onChange={handleFileChange}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-700">
                                <FileCode size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-black uppercase tracking-widest opacity-20">Initialize Code Module</p>
                            </div>
                        )}
                    </div>

                    {/* Bottom Actions Bar */}
                    <div className="p-4 border-t border-slate-800/50 flex justify-between items-center bg-nexus-800/20 backdrop-blur-sm">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500">
                                <GitMerge size={12} />
                                <span>PROTOCOL REVISION v{project.versions.length}</span>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            <Button
                                variant="glass"
                                className="h-8 text-[10px] uppercase font-black"
                                icon={<RotateCcw size={12} />}
                                onClick={() => onUpdateProject({ ...project, files: project.files })} // Simple trigger
                            >
                                Refresh
                            </Button>
                            <Button
                                variant="primary"
                                className="h-8 px-4 text-[10px] uppercase font-black tracking-widest"
                                onClick={() => handleSave()}
                                icon={<Save size={12} />}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tools (Right) */}
            <aside className="w-[400px] flex flex-shrink-0 flex-col border-l border-slate-800/50 bg-nexus-800">
                <div className="p-1 border-b border-slate-800/50">
                    <Tabs
                        tabs={['ASSISTANT', 'AUDIT', 'HISTORY', 'DEPLOY']}
                        activeTab={activeTab}
                        onChange={setActiveTab}
                    />
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'ASSISTANT' && (
                        <div className="flex-1 flex flex-col overflow-hidden bg-nexus-900/20">
                            {/* Messages Container */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                                {chatHistory.length === 0 && (
                                    <div className="text-center py-20 flex flex-col items-center opacity-40">
                                        <Bot size={40} className="text-nexus-cyan mb-4" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">NexOps Assistant</h3>
                                        <p className="text-[10px] text-slate-500 max-w-[220px] mt-2 font-medium">
                                            Describe protocol changes, request security patches, or audit logic across your workspace.
                                        </p>
                                    </div>
                                )}
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[90%] rounded-2xl p-4 text-xs leading-relaxed ${msg.role === 'user'
                                            ? 'bg-nexus-cyan/10 border border-nexus-cyan/20 text-white'
                                            : 'bg-slate-800/50 border border-slate-700/50 text-slate-300'
                                            }`}>
                                            <div className="flex items-center mb-2 text-[9px] uppercase font-black tracking-[0.2em] opacity-40">
                                                {msg.role === 'user' ? 'Operator' : 'AI Logic Unit'}
                                            </div>
                                            <div className="whitespace-pre-wrap font-sans prose prose-invert prose-xs">{msg.text}</div>

                                            {msg.fileUpdates && msg.fileUpdates.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-slate-700/50">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[10px] text-nexus-cyan font-black uppercase tracking-wider">Protocol Proposal</span>
                                                        <Badge variant="info">{msg.fileUpdates.length} Modules</Badge>
                                                    </div>
                                                    <div className="space-y-1.5 mb-4">
                                                        {msg.fileUpdates.map(u => (
                                                            <div key={u.name} className="flex items-center text-[10px] text-slate-400 font-mono bg-nexus-900/80 p-2 rounded-lg border border-slate-800">
                                                                <FileCode size={12} className="mr-2 text-nexus-cyan/70" /> {u.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        variant={msg.isApplied ? 'glass' : 'primary'}
                                                        className="w-full text-[10px] py-2.5 h-auto uppercase font-black tracking-[0.15em] shadow-lg"
                                                        icon={msg.isApplied ? <CheckCircle size={14} className="text-nexus-success" /> : <Wand2 size={14} />}
                                                        disabled={msg.isApplied}
                                                        onClick={() => applyFileUpdates(msg.fileUpdates!, i)}
                                                    >
                                                        {msg.isApplied ? 'Changes Commited' : 'Apply Updates'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isChatting && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800/30 border border-slate-700/30 rounded-full px-4 py-2">
                                            <div className="flex space-x-1.5">
                                                <div className="w-1.5 h-1.5 bg-nexus-cyan rounded-full animate-pulse"></div>
                                                <div className="w-1.5 h-1.5 bg-nexus-cyan rounded-full animate-pulse delay-75"></div>
                                                <div className="w-1.5 h-1.5 bg-nexus-cyan rounded-full animate-pulse delay-150"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Assistant Input */}
                            <div className="p-4 bg-nexus-900 border-t border-slate-800/50">
                                <div className="relative group">
                                    <textarea
                                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pr-14 text-xs text-slate-200 focus:border-nexus-cyan focus:ring-1 focus:ring-nexus-cyan/20 outline-none resize-none h-24 custom-scrollbar transition-all"
                                        placeholder="Command assistant (e.g. 'Add a refund function after a timeout')..."
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!chatInput.trim() || isChatting}
                                        className="absolute bottom-4 right-4 p-2.5 rounded-xl bg-nexus-cyan text-nexus-900 hover:bg-cyan-400 disabled:opacity-10 disabled:grayscale transition-all shadow-xl shadow-nexus-cyan/20"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                                <div className="flex justify-between items-center mt-3 px-2">
                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Shift + Enter for multi-line</span>
                                    <span className="text-[9px] text-slate-600 font-mono uppercase">Engine: Llama-3-Nexus</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'AUDIT' && (
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            <div className="text-center p-6 bg-nexus-900/40 border border-slate-800 rounded-3xl">
                                <ShieldCheck size={48} className="mx-auto text-nexus-cyan mb-4 opacity-50" />
                                <h3 className="text-lg font-black text-white tracking-tight">Security Audit</h3>
                                <p className="text-xs text-slate-500 mt-2 mb-6 font-medium">Static analysis & UTXO logic validation.</p>
                                <Button
                                    className="w-full h-11 rounded-xl text-xs font-black uppercase tracking-widest"
                                    onClick={handleRunAudit}
                                    isLoading={isAuditing}
                                    icon={<Play size={14} />}
                                >
                                    Start Analysis
                                </Button>
                            </div>

                            {project.auditReport && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700 mb-6 shadow-inner">
                                        <div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Grade</span>
                                            <div className={`text-3xl font-black mt-1 ${project.auditReport.score > 80 ? 'text-nexus-success' : 'text-nexus-danger'}`}>
                                                {project.auditReport.score}<span className="text-sm opacity-50 font-medium ml-1">%</span>
                                            </div>
                                        </div>
                                        <Badge variant={project.auditReport.score > 80 ? 'success' : 'high'}>
                                            {project.auditReport.score > 80 ? 'SECURE' : 'UNSAFE'}
                                        </Badge>
                                    </div>

                                    {project.auditReport.score < 80 && (
                                        <Button
                                            variant="secondary"
                                            className="w-full mb-6 h-11 border-nexus-warning/40 text-nexus-warning font-black text-xs uppercase"
                                            onClick={handleAutoFix}
                                            isLoading={isAuditing}
                                            icon={<GitMerge size={16} />}
                                        >
                                            Patch All Faults
                                        </Button>
                                    )}

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 mb-4">Fault Report</h4>
                                        {project.auditReport.vulnerabilities.map((v, i) => (
                                            <div key={i} className="bg-nexus-900/50 p-4 rounded-2xl border border-slate-800/80 transition-all hover:border-slate-700">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-black text-slate-200">{v.title}</span>
                                                    <Badge variant={v.severity.toLowerCase() as any}>{v.severity}</Badge>
                                                </div>
                                                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{v.description}</p>
                                                <div className="text-[10px] text-nexus-cyan font-bold bg-nexus-cyan/5 p-3 rounded-xl border border-nexus-cyan/10">
                                                    <div className="uppercase tracking-widest text-[8px] mb-1 opacity-60">Recommendation</div>
                                                    {v.fixSuggestion}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'HISTORY' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Commit History</span>
                                <Badge variant="info">{project.versions.length} versions</Badge>
                            </div>
                            {project.versions.map((v, i) => (
                                <div key={v.id} className="p-4 bg-nexus-900/60 border border-slate-800 rounded-2xl group transition-all hover:bg-nexus-900/80 hover:border-slate-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-[10px] font-black text-nexus-cyan bg-nexus-cyan/10 px-2 py-0.5 rounded-full">REV {project.versions.length - i}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{v.author}</span>
                                        </div>
                                        <span className="text-[9px] text-slate-600 font-mono">{new Date(v.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-4 line-clamp-2">{v.description}</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCompareVersion(compareVersion?.id === v.id ? null : v)}
                                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${compareVersion?.id === v.id
                                                ? 'bg-nexus-cyan border-nexus-cyan text-nexus-900'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {compareVersion?.id === v.id ? 'Hide Diff' : 'Compare'}
                                        </button>
                                        <button
                                            onClick={() => handleRevert(v)}
                                            className="flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest bg-slate-800 border border-slate-700 rounded-lg text-nexus-danger hover:bg-nexus-danger hover:text-white transition-all"
                                        >
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'DEPLOY' && (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-black/20">
                            <Deployment
                                project={project}
                                walletConnected={walletConnected}
                                onConnectWallet={onConnectWallet}
                                onUpdateProject={onUpdateProject}
                            />
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
};
