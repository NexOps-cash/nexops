
import React, { useState, useEffect, useRef } from 'react';
import { Button, Tabs, getFileIcon, Badge } from '../components/UI';
import { MonacoEditorWrapper } from '../components/MonacoEditorWrapper';
import { WorkbenchLayout } from '../components/WorkbenchLayout';
import { NamedTaskTerminal } from '../components/NamedTaskTerminal';
import { Project, ProjectFile, CodeVersion } from '../types';
import {
    Folder, Save, Play, ShieldCheck, History, Rocket,
    Download, Settings, FilePlus, ChevronRight, ChevronDown,
    AlertTriangle, CheckCircle, Copy, GitMerge, RotateCcw,
    FileJson, MessageSquare, Send, User, Bot, Wand2, X,
    FileCode
} from 'lucide-react';
import { auditSmartContract, fixSmartContract, chatWithAssistant } from '../services/groqService';
import { compileCashScript } from '../services/compilerService';
import { DebuggerService, DebuggerState } from '../services/DebuggerService';
import { DebugStackVisualizer } from '../components/DebugStackVisualizer';
import { ProblemsPanel, Problem } from '../components/ProblemsPanel';
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
    walletConnected: boolean;
    onConnectWallet: () => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onUpdateProject, walletConnected, onConnectWallet }) => {
    // -- State --
    const [activeFileName, setActiveFileName] = useState<string>(project.files[0]?.name || '');
    const [activeView, setActiveView] = useState<'EXPLORER' | 'AUDITOR' | 'DEBUG'>('EXPLORER');
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    // Tools State
    const [isAuditing, setIsAuditing] = useState(false);
    const [deploymentLog, setDeploymentLog] = useState<string[]>([]);
    const [activeBottomTab, setActiveBottomTab] = useState<'TERMINAL' | 'OUTPUT' | 'PROBLEMS'>('TERMINAL');
    const [problems, setProblems] = useState<Problem[]>([]);
    const [debugState, setDebugState] = useState<DebuggerState | null>(null);
    const debuggerRef = useRef<DebuggerService>(new DebuggerService());

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

        const newHistory = [...chatHistory];
        newHistory[messageIndex] = { ...newHistory[messageIndex], isApplied: true };
        setChatHistory(newHistory);

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
        setDeploymentLog(prev => [...prev, 'Starting Audit...']);
        try {
            const report = await auditSmartContract(mainContractFile.content);
            onUpdateProject({ ...project, auditReport: report });
            setDeploymentLog(prev => [...prev, 'Audit Complete. Issues found: ' + report.vulnerabilities.length]);
        } catch (e) {
            console.error(e);
            setDeploymentLog(prev => [...prev, 'Audit Failed.']);
        } finally {
            setIsAuditing(false);
        }
    };

    const handleDeploy = () => {
        setDeploymentLog(prev => [...prev, 'Initiating Deployment Flow via WalletConnect...']);
        // The actual deployment logic is handled by the Deployment component now usually, 
        // but for this task bar we are just mocking the start of the process logs
    };

    const handleRunTask = async (task: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setDeploymentLog(prev => [...prev, `[${timestamp}] Executing ${task}...`]);

        if (task === 'COMPILE') {
            if (!mainContractFile) {
                setDeploymentLog(prev => [...prev, `[${timestamp}] Error: No .cash file found.`]);
                return;
            }

            setDeploymentLog(prev => [...prev, `[${timestamp}] Compiling ${mainContractFile.name}...`]);

            try {
                // Verify cashc import and run compilation
                await new Promise(resolve => setTimeout(resolve, 10));

                const result = compileCashScript(mainContractFile.content);

                if (result.success && result.artifact) {
                    const bytes = result.artifact.bytecode.length / 2;

                    // Create/Update Artifact File
                    const artifactContent = JSON.stringify(result.artifact, null, 2);
                    const artifactFileName = `${result.artifact.contractName}.json`;

                    const updatedFiles = [...project.files];
                    const existingIndex = updatedFiles.findIndex(f => f.name === artifactFileName);

                    if (existingIndex !== -1) {
                        updatedFiles[existingIndex] = { ...updatedFiles[existingIndex], content: artifactContent };
                    } else {
                        updatedFiles.push({
                            name: artifactFileName,
                            content: artifactContent,
                            language: 'json',
                            readOnly: true
                        });
                    }

                    onUpdateProject({ ...project, files: updatedFiles });

                    setDeploymentLog(prev => [
                        ...prev,
                        `[${timestamp}] ✅ Compile Success!`,
                        `[${timestamp}]   - Contract: ${result.artifact.contractName}`,
                        `[${timestamp}]   - Bytecode Size: ${bytes} bytes`,
                        `[${timestamp}]   - Artifact: ${artifactFileName} saved to explorer.`
                    ]);
                    setProblems([]); // Clear problems on success
                    setActiveBottomTab('OUTPUT');

                } else {
                    setDeploymentLog(prev => [
                        ...prev,
                        `[${timestamp}] ❌ Compile Failed:`,
                        ...(result.errors.map(e => `[${timestamp}]   ${e}`))
                    ]);

                    // Parse Errors for Problems Tab
                    const newProblems: Problem[] = result.errors.map((err, idx) => {
                        // Simple regex to find line number if present
                        const lineMatch = err.match(/line (\d+)/i);
                        const line = lineMatch ? parseInt(lineMatch[1]) : undefined;
                        return {
                            id: `err-${Date.now()}-${idx}`,
                            severity: 'error' as const,
                            file: mainContractFile.name,
                            message: err,
                            line
                        };
                    });
                    setProblems(newProblems);
                    setActiveBottomTab('PROBLEMS');
                }

            } catch (e: any) {
                setDeploymentLog(prev => [...prev, `[${timestamp}] Critical Error: ${e.message}`]);
                console.error(e);
            }

        } else if (task === 'AUDIT') {
            handleRunAudit();
        } else if (task === 'DEPLOY') {
            handleDeploy();
        }
    };

    // -- Render Helpers --

    const renderSidebarExplorer = () => (
        <div className="flex-1 overflow-y-auto no-scrollbar py-2">
            <div className="px-4 mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{project.name}</span>
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
            <div className="px-4 mt-6 mb-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">History</span>
            </div>
            <div className="px-2 space-y-1">
                {project.versions.slice(0, 5).map(v => (
                    <div key={v.id} className="flex items-center text-[10px] text-slate-500 px-2 py-1 hover:text-slate-300 cursor-pointer" onClick={() => setCompareVersion(v)}>
                        <History size={10} className="mr-2" />
                        <span className="truncate">{new Date(v.timestamp).toLocaleTimeString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderSidebarAuditor = () => (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatHistory.length === 0 && (
                    <div className="text-center py-10 opacity-40">
                        <Bot size={32} className="mx-auto text-nexus-cyan mb-2" />
                        <p className="text-[10px]">AI Assistant Ready</p>
                    </div>
                )}
                {chatHistory.map((msg, i) => (
                    <div key={i} className={`p-3 rounded-xl text-xs ${msg.role === 'user' ? 'bg-nexus-cyan/10 text-white self-end text-right' : 'bg-slate-800/50 text-slate-300'}`}>
                        <div className="font-bold opacity-50 text-[9px] mb-1 uppercase">{msg.role}</div>
                        {msg.text}
                        {msg.fileUpdates && (
                            <Button size="sm" variant="glass" className="mt-2 w-full text-[10px]" onClick={() => applyFileUpdates(msg.fileUpdates!, i)} disabled={msg.isApplied}>
                                {msg.isApplied ? 'Applied' : 'Apply Changes'}
                            </Button>
                        )}
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="p-2 border-t border-slate-800 bg-nexus-900">
                <textarea
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="w-full bg-slate-800 text-xs p-2 rounded-lg outline-none border border-slate-700 focus:border-nexus-cyan"
                    placeholder="Ask AI..."
                    rows={2}
                />
            </div>
        </div>
    );

    const handleStartDebug = async () => {
        if (!mainContractFile) return;

        // Re-compile to get fresh bytecode
        const result = compileCashScript(mainContractFile.content);
        if (result.success && result.artifact) {
            setDeploymentLog(prev => [...prev, `[Debug] Loaded ${result.artifact?.contractName} for simulation.`]);
            debuggerRef.current.load(result.artifact.bytecode);
            setDebugState(debuggerRef.current.getState());
        } else {
            setDeploymentLog(prev => [...prev, `[Debug] Compile failed. Cannot start simulation.`]);
        }
    };

    const handleDebugStep = () => {
        const newState = debuggerRef.current.step();
        setDebugState(newState);
    };

    const handleDebugReset = () => {
        debuggerRef.current.reset();
        setDebugState(debuggerRef.current.getState());
    };

    const renderSidebarDebug = () => (
        <div className="flex flex-col h-full">
            {!debugState ? (
                <div className="p-4">
                    <div className="text-xs text-slate-500 mb-4">Execution Config</div>
                    <div className="space-y-4">
                        <div className="bg-slate-800 p-2 rounded border border-slate-700">
                            <div className="text-[10px] font-bold text-slate-400 mb-1">NETWORK</div>
                            <div className="text-nexus-cyan text-xs">Chipnet (Testnet)</div>
                        </div>
                        <Button className="w-full text-xs" icon={<Play size={12} />} onClick={handleStartDebug}>
                            Run Simulation
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col h-full bg-[#0f172a]">
                    {/* Controls */}
                    <div className="p-2 border-b border-slate-700 bg-slate-800/50 flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <button onClick={handleDebugStep} disabled={debugState.isHalting} className="p-1.5 hover:bg-slate-700 rounded text-nexus-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Step">
                                <Play size={14} className="fill-current" />
                            </button>
                            <button onClick={handleDebugReset} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors" title="Reset">
                                <RotateCcw size={14} />
                            </button>
                        </div>
                        <div className="text-[10px] mono text-slate-500 font-medium">
                            PC: {debugState.programCounter.toString(16).toUpperCase().padStart(2, '0')} | <span className="text-nexus-cyan">{debugState.nextOpcode}</span>
                        </div>
                    </div>

                    {/* Visualizer */}
                    <div className="flex-1 overflow-hidden relative">
                        <DebugStackVisualizer stack={debugState.stack} altStack={debugState.altStack} />
                    </div>

                    {/* Opcode History (Logs style) */}
                    <div className="h-1/3 border-t border-slate-700 bg-black/40 p-2 overflow-y-auto font-mono text-[10px] text-slate-400 custom-scrollbar">
                        <div className="text-slate-500 font-bold mb-1 text-[9px] uppercase tracking-wider">Opcode History</div>
                        {debugState.opcodeHistory.slice().reverse().map((op, i) => (
                            <div key={i} className="opacity-75 hover:opacity-100">{op}</div>
                        ))}
                        {debugState.isHalting && <div className="text-nexus-warning mt-2 font-bold">-- END OF EXECUTION --</div>}
                    </div>
                </div>
            )}
        </div>
    );

    const renderSidebarDeploy = () => (
        <Deployment
            project={project}
            onUpdateProject={onUpdateProject}
            walletConnected={walletConnected}
            onConnectWallet={onConnectWallet}
            compact={true}
        />
    );

    const renderEditorArea = () => (
        <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="h-9 flex items-center bg-nexus-900 border-b border-slate-800 px-0">
                {uniqueFiles.map(file => (
                    <button
                        key={file.name}
                        onClick={() => setActiveFileName(file.name)}
                        className={`flex items-center space-x-2 px-3 h-full text-[11px] font-medium border-r border-slate-800 transition-all ${activeFileName === file.name
                            ? 'bg-nexus-800 text-white border-t-2 border-t-nexus-cyan'
                            : 'text-slate-500 hover:bg-slate-800/50'
                            }`}
                    >
                        <span>{getFileIcon(file.name)}</span>
                        <span>{file.name}</span>
                        {unsavedChanges && activeFileName === file.name && <div className="w-1.5 h-1.5 rounded-full bg-nexus-warning ml-1"></div>}
                    </button>
                ))}
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
                {compareVersion && activeFile ? (
                    <MonacoEditorWrapper
                        key={`${activeFile.name}-diff`}
                        code={activeFile.content}
                        originalCode={compareVersion.code}
                        language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                        diffMode={true}
                        onChange={() => { }}
                        readOnly={true}
                    />
                ) : activeFile ? (
                    <MonacoEditorWrapper
                        key={activeFile.name}
                        code={activeFile.content}
                        language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                        onChange={(val) => handleFileChange(val || '')}
                        readOnly={!!activeFile.readOnly}
                        markers={problems.filter(p => p.file === activeFile.name)}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 text-xs uppercase tracking-widest font-bold">
                        No File Selected
                    </div>
                )}
            </div>

            {/* Editor Actions / Footer */}
            {activeFile && (
                <div className="h-6 bg-nexus-cyan/5 border-t border-slate-800 flex items-center justify-between px-3">
                    <div className="flex items-center space-x-3 text-[10px] text-slate-500 font-mono">
                        <span>Master</span>
                        <span>Ln 1, Col 1</span>
                        <span>UTF-8</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        {unsavedChanges && <span className="text-[10px] text-nexus-warning animate-pulse">● Unsaved</span>}
                        <button onClick={() => handleSave()} className="text-[10px] text-slate-400 hover:text-nexus-cyan hover:underline">Save</button>
                    </div>
                </div>
            )}
        </div>
    );

    const renderBottomPanel = () => (
        <NamedTaskTerminal
            onRunTask={handleRunTask}
            logs={deploymentLog}
        />
    );

    return (
        <WorkbenchLayout
            activeView={activeView}
            onViewChange={setActiveView}
            sidebarContent={
                activeView === 'EXPLORER' ? renderSidebarExplorer() :
                    activeView === 'AUDITOR' ? renderSidebarAuditor() :
                        activeView === 'DEBUG' ? renderSidebarDebug() :
                            renderSidebarDeploy()
            }
            editorContent={renderEditorArea()}
            bottomPanelContent={renderBottomPanel()}
            activeBottomTab={activeBottomTab}
            onTabChange={setActiveBottomTab}
            problemsCount={problems.length}
            outputLogs={deploymentLog}
            problemsContent={
                <ProblemsPanel
                    problems={problems}
                    onNavigate={(file, line) => {
                        setActiveFileName(file);
                        // In a real implementation, we would also scroll to line using editor ref
                    }}
                />
            }
        />
    );
};
