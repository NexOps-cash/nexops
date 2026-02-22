
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button, Tabs, getFileIcon, Badge } from '../components/UI';
import { MonacoEditorWrapper } from '../components/MonacoEditorWrapper';
import { WorkbenchLayout } from '../components/WorkbenchLayout';
import { NamedTaskTerminal, TerminalChannel } from '../components/NamedTaskTerminal';
import { Project, ProjectFile, CodeVersion } from '../types';
import {
    Folder, Save, Play, ShieldCheck, History, Rocket,
    Download, Settings, FilePlus, ChevronRight, ChevronDown,
    AlertTriangle, CheckCircle, Copy, GitMerge, RotateCcw,
    FileJson, MessageSquare, Send, User, Bot, Wand2, X,
    FileCode, Zap, Cpu
} from 'lucide-react';
import { auditSmartContract, fixSmartContract, chatWithAssistant } from '../services/groqService';
import { websocketService } from '../services/websocketService';
import { compileCashScript, ContractArtifact } from '../services/compilerService';
import { DebuggerService, DebuggerState } from '../services/DebuggerService';
import { walletConnectService } from '../services/walletConnectService';
import { TransactionBuilder } from '../components/TransactionBuilder';
import { DebugStackVisualizer } from '../components/DebugStackVisualizer';
import { ProblemsPanel, Problem } from '../components/ProblemsPanel';
import { Deployment } from './Deployment';
import { AIPanel } from '../components/AIPanel';
import { AuditReport, Vulnerability } from '../types';
import { ArtifactInspector } from '../components/ArtifactInspector';
import { FlowBuilder, FlowPalette } from '../components/flow/FlowBuilder';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    fileUpdates?: { name: string, content: string }[];
    isApplied?: boolean;
    auditReport?: AuditReport;
    isProgress?: boolean;
    stage?: string;
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
    const [wcSession, setWcSession] = useState<any>(null);

    // Initialize WalletConnect on mount
    useEffect(() => {
        walletConnectService.init();
    }, []);

    // Listen for WalletConnect session changes
    useEffect(() => {
        const handleStatusChange = () => {
            setWcSession(walletConnectService.getSession());
        };

        walletConnectService.on('connection_status_changed', handleStatusChange);
        return () => {
            walletConnectService.off('connection_status_changed', handleStatusChange);
        };
    }, []);
    const [activeView, setActiveView] = useState<'EXPLORER' | 'AUDITOR' | 'DEBUG' | 'DEPLOY' | 'INTERACT' | 'FLOW'>('EXPLORER');
    const [unsavedChanges, setUnsavedChanges] = useState(false);

    // Tools State
    const [isAuditing, setIsAuditing] = useState(false);
    const [channelLogs, setChannelLogs] = useState<Record<TerminalChannel, string[]>>({
        SYSTEM: ['[System] NexOps Workstation initialized.', '[System] Ready.'],
        COMPILER: [],
        AUDITOR: [],
        PROBLEMS: []
    });
    const [activeTerminalChannel, setActiveTerminalChannel] = useState<TerminalChannel>('SYSTEM');
    const [problems, setProblems] = useState<Problem[]>([]);
    const [debugState, setDebugState] = useState<DebuggerState | null>(null);
    const [debugArgs, setDebugArgs] = useState<number[]>([]);
    const debuggerRef = useRef<DebuggerService>(new DebuggerService());

    // Assistant State
    const [chatInput, setChatInput] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isChatting, setIsChatting] = useState(false);
    const [chatDraft, setChatDraft] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Version State
    const [compareVersion, setCompareVersion] = useState<CodeVersion | null>(null);

    // Deployment State
    const [deployedArtifact, setDeployedArtifact] = useState<ContractArtifact | null>(null);
    const [deployedAddress, setDeployedAddress] = useState<string>('');
    const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
    const [useExternalGenerator, setUseExternalGenerator] = useState(false);
    const [isWsConnected, setIsWsConnected] = useState(false);

    // Derived State
    const activeFile = project.files.find(f => f.name === activeFileName);
    const mainContractFile = useMemo(() => {
        if (activeFile?.name.endsWith('.cash')) return activeFile;
        return project.files.find(f => f.name.endsWith('.cash'));
    }, [project.files, activeFile]);

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

    const addLog = (channel: TerminalChannel, message: string | string[]) => {
        const timestamp = new Date().toLocaleTimeString();
        const messages = Array.isArray(message) ? message : [message];
        const formatted = messages.map(m => `[${timestamp}] ${m}`);

        setChannelLogs(prev => ({
            ...prev,
            [channel]: [...prev[channel], ...formatted]
        }));
    };

    // Scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    // WebSocket Setup
    useEffect(() => {
        const handleConnected = () => setIsWsConnected(true);
        const handleDisconnected = () => setIsWsConnected(false);
        const handleMessage = (data: any) => {
            if (data.type === 'update') {
                const progressText = `[${data.stage}] ${data.message} (Attempt: ${data.attempt || 1})`;

                // Consolidate progress updates into a single overriding message
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];

                    if (lastMsg && lastMsg.role === 'model' && lastMsg.isProgress) {
                        // Override previous update
                        newHistory[newHistory.length - 1] = {
                            ...lastMsg,
                            text: progressText,
                            stage: data.stage
                        };
                        return newHistory;
                    } else {
                        // Create first update message
                        return [...prev, {
                            role: 'model',
                            text: progressText,
                            isProgress: true,
                            stage: data.stage
                        }];
                    }
                });
                addLog('SYSTEM', progressText);
            } else if (data.type === 'success') {
                const { code, contract_name, toll_gate } = data.data;
                const fileName = `${contract_name || (activeFileName?.split('.')[0] || 'Generated')}.cash`;
                console.log("✅ Synthesis Success Processing:", { fileName, codeLength: code.length });
                addLog('SYSTEM', `✅ Synthesis Success: ${contract_name} (${(toll_gate.score * 100).toFixed(0)}%)`);

                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    const successMsg: ChatMessage = {
                        role: 'model',
                        text: `✅ Synthesis Complete: ${contract_name}\nScore: ${(toll_gate.score * 100).toFixed(0)}%\n\nThe contract passed with the following features: ${data.data.intent_model.features.join(', ')}.`,
                        fileUpdates: [{ name: fileName, content: code }]
                    };

                    if (lastMsg && lastMsg.role === 'model' && lastMsg.isProgress) {
                        // Replace progress with success
                        newHistory[newHistory.length - 1] = successMsg;
                        return newHistory;
                    }
                    return [...prev, successMsg];
                });
                setIsChatting(false);
            } else if (data.type === 'error') {
                const { code, message, details } = data.error;
                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    const errorMsg: ChatMessage = {
                        role: 'model',
                        text: `❌ ERROR: ${code}\n${message}${details ? `\n\nDetails: ${details}` : ''}`
                    };

                    if (lastMsg && lastMsg.role === 'model' && lastMsg.isProgress) {
                        // Replace progress with error
                        newHistory[newHistory.length - 1] = errorMsg;
                        return newHistory;
                    }
                    return [...prev, errorMsg];
                });
                setIsChatting(false);
            }
        };

        websocketService.on('connected', handleConnected);
        websocketService.on('disconnected', handleDisconnected);
        websocketService.on('message', handleMessage);

        if (useExternalGenerator) {
            websocketService.connect();
        }

        return () => {
            websocketService.off('connected', handleConnected);
            websocketService.off('disconnected', handleDisconnected);
            websocketService.off('message', handleMessage);
        };
    }, [useExternalGenerator, activeFileName]);

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

        if (activeFileName.endsWith('.cash')) {
            updatedProject.contractCode = newContent;
        }

        setUnsavedChanges(true);
        onUpdateProject(updatedProject);
    };

    const handleSave = (description: string = `Snapshot: ${new Date().toLocaleTimeString()}`) => {
        const newVersion: CodeVersion = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            fileName: activeFileName,
            code: activeFile?.content || '',
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

    const handleRestoreVersion = (version: CodeVersion) => {
        const updatedFiles = project.files.map(f =>
            f.name === version.fileName ? { ...f, content: version.code } : f
        );

        onUpdateProject({
            ...project,
            files: updatedFiles,
            auditReport: undefined,
            lastModified: Date.now()
        });

        setCompareVersion(null);
        setUnsavedChanges(true);
    };

    const handleSendMessage = async (message?: string) => {
        const msgToSend = message || chatInput;
        if (!msgToSend.trim() || isChatting) return;

        setChatInput('');
        setChatHistory(prev => [...prev, { role: 'user', text: msgToSend }]);
        setIsChatting(true);

        if (useExternalGenerator) {
            if (!websocketService.isConnected()) {
                websocketService.connect();
                // We'll wait a bit or just fail fast
                setTimeout(() => {
                    if (websocketService.isConnected()) {
                        websocketService.sendIntent(msgToSend, chatHistory.map(h => ({ role: h.role, content: h.text })));
                    } else {
                        setChatHistory(prev => [...prev, { role: 'model', text: "External Generator is not connected. Attempting to reconnect..." }]);
                        setIsChatting(false);
                    }
                }, 1000);
            } else {
                websocketService.sendIntent(msgToSend, chatHistory.map(h => ({ role: h.role, content: h.text })));
            }
            return;
        }

        try {
            const result = await chatWithAssistant(msgToSend, project.files, chatHistory);
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
        console.log("📝 Applying File Updates:", updates);
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
            fileName: mainUpdate ? mainUpdate.name : (mainContractFile?.name || 'unknown.cash'),
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
        addLog('AUDITOR', 'Starting Security Audit...');

        // Show indicator in Chat
        setChatHistory(prev => [...prev, { role: 'user', text: 'Run Security Audit' }]);

        try {
            const report = await auditSmartContract(mainContractFile.content, useExternalGenerator);
            onUpdateProject({ ...project, auditReport: report });
            addLog('AUDITOR', '✅ Audit Complete. Issues found: ' + report.vulnerabilities.length);

            // Push Report to Chat
            setChatHistory(prev => [...prev, {
                role: 'model',
                text: report.summary,
                auditReport: report
            }]);

            // Switch to Auditor view
            setActiveView('AUDITOR');

        } catch (e: any) {
            console.error(e);
            addLog('AUDITOR', `❌ Audit Failed: ${e.message}`);
            setChatHistory(prev => [...prev, { role: 'model', text: "Audit Failed due to an internal error." }]);
        } finally {
            setIsAuditing(false);
        }
    };

    const handleFixVulnerability = async (vuln: Vulnerability) => {
        if (!mainContractFile) return;
        setIsChatting(true);

        const prompt = `Fix this vulnerability:\nTitle: ${vuln.title}\nDescription: ${vuln.description}\nRecommendation: ${vuln.recommendation}`;
        setChatHistory(prev => [...prev, { role: 'user', text: prompt }]);

        try {
            const result = await fixSmartContract(mainContractFile.content, prompt, useExternalGenerator, vuln);

            // Handle external repair failure (success: false)
            if (useExternalGenerator && result.explanation.includes("AI Repair failed safety constraints")) {
                // We'll show this in the chat, but also could use a toast if available.
                // For now, appending to chat as per existing pattern.
            }

            setChatHistory(prev => [...prev, {
                role: 'model',
                text: result.explanation,
                fileUpdates: [{ name: mainContractFile.name, content: result.code }]
            }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Failed to generate fix." }]);
        } finally {
            setIsChatting(false);
        }
    };

    const handleDeploy = () => {
        addLog('SYSTEM', 'Initiating Deployment Flow via WalletConnect...');
        // The actual deployment logic is handled by the Deployment component now usually, 
        // but for this task bar we are just mocking the start of the process logs
    };

    const handleRunTask = async (task: string) => {
        if (task === 'COMPILE') {
            if (!mainContractFile) {
                addLog('SYSTEM', '❌ Error: No .cash file found.');
                return;
            }

            setActiveTerminalChannel('COMPILER');
            addLog('COMPILER', `Compiling ${mainContractFile.name}...`);

            try {
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

                    addLog('COMPILER', [
                        `✅ Compile Success!`,
                        `  - Contract: ${result.artifact.contractName}`,
                        `  - Bytecode Size: ${bytes} bytes`,
                        `  - Artifact: ${artifactFileName} saved to explorer.`
                    ]);
                    setDeployedArtifact(result.artifact);
                    setProblems([]);

                } else {
                    addLog('COMPILER', '❌ Compile Failed:');
                    result.errors.forEach(e => addLog('COMPILER', `  ${e}`));

                    // Parse Errors for Problems Tab
                    const newProblems: Problem[] = result.errors.map((err, idx) => {
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
                    setActiveTerminalChannel('PROBLEMS');
                }

            } catch (e: any) {
                addLog('COMPILER', `Critical Error: ${e.message}`);
                console.error(e);
            }

        } else if (task === 'AUDIT') {
            setActiveTerminalChannel('AUDITOR');
            handleRunAudit();
        } else if (task === 'DEPLOY') {
            setActiveTerminalChannel('COMPILER');
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
            <div className="px-4 mt-6 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">History</span>
                <span className="text-[9px] text-slate-600 font-mono italic truncate max-w-[80px]">{activeFileName}</span>
            </div>
            <div className="px-2 space-y-1">
                {(() => {
                    const fileVersions = project.versions.filter(v => v.fileName === activeFileName);
                    return fileVersions.slice(0, 10).map((v, idx) => {
                        const versionNumber = fileVersions.length - (fileVersions.indexOf(v));
                        return (
                            <div
                                key={v.id}
                                className={`flex items-center text-[10px] px-2 py-1.5 rounded cursor-pointer transition-colors ${compareVersion?.id === v.id
                                    ? 'bg-nexus-cyan/20 text-nexus-cyan'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                onClick={() => setCompareVersion(compareVersion?.id === v.id ? null : v)}
                            >
                                <History size={10} className="mr-2 shrink-0" />
                                <span className="truncate font-mono">Version {versionNumber}</span>
                                <span className="ml-2 text-[8px] opacity-40 truncate">{new Date(v.timestamp).toLocaleTimeString()}</span>
                                {v.author === 'AI' && <span className="ml-auto text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">AI</span>}
                            </div>
                        );
                    });
                })()}
                {project.versions.filter(v => v.fileName === activeFileName).length === 0 && (
                    <div className="px-4 py-2 text-[9px] text-slate-600 italic">No snapshots for this file.</div>
                )}
            </div>
        </div>
    );

    const renderSidebarAuditor = () => (
        <AIPanel
            history={chatHistory}
            onSend={handleSendMessage}
            isBusy={isChatting}
            onApply={applyFileUpdates}
            onFixVulnerability={handleFixVulnerability}
            draftInput={chatDraft}
            useExternalGenerator={useExternalGenerator}
            onToggleExternal={setUseExternalGenerator}
            isWsConnected={isWsConnected}
        />
    );

    const handleStartDebug = async () => {
        if (!mainContractFile) return;

        // Re-compile to get fresh bytecode
        const result = compileCashScript(mainContractFile.content);
        if (result.success && result.artifact) {
            try {
                addLog('SYSTEM', `[Debug] Loaded ${result.artifact?.contractName} for simulation.`);
                const unlockingHex = debuggerRef.current.buildUnlockingFromNumbers(debugArgs);
                await debuggerRef.current.load(result.artifact.bytecode, unlockingHex);
                setDebugState(debuggerRef.current.getState());
            } catch (err: any) {
                addLog('SYSTEM', `[Debug] Error starting simulation: ${err.message}`);
                setActiveTerminalChannel('SYSTEM');
            }
        } else {
            addLog('SYSTEM', `[Debug] Compile failed. Cannot start simulation.`);
            setActiveTerminalChannel('COMPILER');
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

                    {/* NEW ARGS PANEL */}
                    <div className="mb-4 bg-slate-800 p-2 rounded border border-slate-700">
                        <div className="text-[10px] font-bold text-slate-400 mb-2 flex justify-between items-center">
                            <span>FUNCTION ARGUMENTS</span>
                            <div className="space-x-1">
                                <button onClick={() => setDebugArgs([...debugArgs, 0])} className="px-1.5 py-0.5 bg-nexus-cyan/20 text-nexus-cyan rounded hover:bg-nexus-cyan/40">+</button>
                                <button onClick={() => setDebugArgs(debugArgs.slice(0, -1))} disabled={debugArgs.length === 0} className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/40 disabled:opacity-50">-</button>
                            </div>
                        </div>
                        {debugArgs.length === 0 ? (
                            <div className="text-[10px] text-slate-500 italic">No arguments</div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {debugArgs.map((arg, idx) => (
                                    <input
                                        key={idx}
                                        type="number"
                                        value={arg}
                                        onChange={(e) => {
                                            const newArgs = [...debugArgs];
                                            newArgs[idx] = parseInt(e.target.value) || 0;
                                            setDebugArgs(newArgs);
                                        }}
                                        className="w-12 bg-black/50 border border-slate-600 rounded px-1 text-xs text-white text-center focus:border-nexus-cyan outline-none"
                                    />
                                ))}
                            </div>
                        )}
                        <div className="mt-2 text-[8px] font-mono text-slate-500 break-all">
                            Unlocking Script: {(() => {
                                try {
                                    return debuggerRef.current.buildUnlockingFromNumbers(debugArgs) || 'Empty';
                                } catch (e: any) {
                                    return <span className="text-red-400">{e.message}</span>;
                                }
                            })()}
                        </div>
                    </div>

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

    const renderSidebarInteract = () => (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {!deployedArtifact ? (
                <div className="text-center py-10 text-gray-500">
                    <Rocket className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-xs uppercase tracking-widest font-bold">No Active Deployment</p>
                    <p className="text-[10px] mt-2">Deploy a contract to enable interaction.</p>
                </div>
            ) : (
                <TransactionBuilder
                    artifact={deployedArtifact}
                    deployedAddress={deployedAddress}
                    constructorArgs={constructorArgs}
                    wcSession={walletConnectService.getSession()}
                />
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
            onDeployed={(addr, artifact, args) => {
                setDeployedAddress(addr);
                setDeployedArtifact(artifact);
                setConstructorArgs(args);
                setActiveView('INTERACT'); // Auto-navigate to Interact
            }}
            onNavigate={(view) => setActiveView(view)}
        />
    );

    const isArtifactFile = (file: ProjectFile) => {
        if (!file.name.endsWith('.json')) return false;
        try {
            const content = JSON.parse(file.content);
            return !!(content.contractName && content.bytecode && content.abi);
        } catch (e) {
            return false;
        }
    };

    const renderSidebarFlow = () => (
        <div className="flex flex-col h-full overflow-hidden">
            <FlowPalette onAddNode={(type) => {
                // This will trigger the addNode inside FlowBuilder via a message or internal mechanism
                // For now, we'll use a custom event as a simple way to bridge independent components
                const event = new CustomEvent('nexops:flow:add-node', { detail: { type } });
                window.dispatchEvent(event);
            }} />
            <div className="p-4 border-t border-white/5 bg-black/20">
                <Button variant="primary" className="w-full text-xs font-bold uppercase tracking-widest py-2.5 h-auto">
                    <Play size={14} className="mr-2" /> Execute Flow
                </Button>
            </div>
        </div>
    );

    const renderEditorArea = () => {
        const artifactData = activeFile && isArtifactFile(activeFile) ? JSON.parse(activeFile.content) : null;

        return (
            <div className="flex flex-col h-full overflow-hidden bg-[#0a0a0c]">
                {/* Tabs */}
                <div className="h-9 flex items-center bg-nexus-900 border-b border-white/5 px-0 shrink-0">
                    {uniqueFiles.map(file => (
                        <button
                            key={file.name}
                            onClick={() => setActiveFileName(file.name)}
                            className={`flex items-center space-x-2 px-3 h-full text-[11px] font-medium border-r border-white/5 transition-all ${activeFileName === file.name
                                ? 'bg-nexus-800 text-white border-t-2 border-t-nexus-cyan'
                                : 'text-slate-500 hover:bg-slate-800/50'
                                }`}
                        >
                            <span className="shrink-0">{getFileIcon(file.name)}</span>
                            <span className="truncate max-w-[120px]">{file.name}</span>
                            {unsavedChanges && activeFileName === file.name && <div className="w-1.5 h-1.5 rounded-full bg-nexus-warning ml-1 shrink-0"></div>}
                        </button>
                    ))}
                </div>

                {/* Editor Content */}
                <div className="flex-1 relative min-h-0">
                    {compareVersion && activeFile && (!compareVersion.fileName || compareVersion.fileName === activeFile.name) ? (
                        <MonacoEditorWrapper
                            key={`${activeFile.name}-diff`}
                            code={activeFile.content}
                            originalCode={compareVersion.code}
                            language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                            diffMode={true}
                            onChange={() => { }}
                            readOnly={true}
                        />
                    ) : activeView === 'FLOW' ? (
                        <FlowBuilder />
                    ) : activeFile ? (
                        artifactData ? (
                            <ArtifactInspector
                                artifact={artifactData}
                                onDeploy={() => {
                                    setDeployedArtifact(artifactData);
                                    setActiveView('DEPLOY');
                                }}
                            />
                        ) : (
                            <MonacoEditorWrapper
                                key={activeFile.name}
                                code={activeFile.content}
                                language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                                onChange={(val) => handleFileChange(val || '')}
                                readOnly={!!activeFile.readOnly}
                                markers={problems.filter(p => p.file === activeFile.name)}
                            />
                        )
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-600 text-xs uppercase tracking-widest font-bold">
                            No File Selected
                        </div>
                    )}
                </div>
            </div>
        );
    };


    const renderBottomPanel = () => (
        <NamedTaskTerminal
            onRunTask={handleRunTask}
            channelLogs={channelLogs}
            activeChannel={activeTerminalChannel}
            onActiveChannelChange={setActiveTerminalChannel}
            onClearLogs={(chn) => setChannelLogs(prev => ({ ...prev, [chn]: [] }))}
            problemsCount={problems.length}
            problemsContent={
                <ProblemsPanel
                    problems={problems}
                    onNavigate={(file, line) => {
                        setActiveFileName(file);
                    }}
                    onAskAI={(problem: Problem) => {
                        const msg = `Explain this error in ${problem.file}${problem.line ? `:${problem.line}` : ''}: ${problem.message}`;
                        setChatDraft(msg);
                        setActiveView('AUDITOR');
                    }}
                />
            }
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
                            activeView === 'INTERACT' ? renderSidebarInteract() :
                                activeView === 'FLOW' ? renderSidebarFlow() :
                                    renderSidebarDeploy()
            }
            editorContent={renderEditorArea()}
            bottomPanelContent={renderBottomPanel()}
            problemsCount={problems.length}
            statusBarState={{
                activeFileName: activeFileName,
                isModified: unsavedChanges,
                activeChannel: activeTerminalChannel,
                language: activeFileName?.endsWith('.cash') ? 'CashScript' :
                    activeFileName?.endsWith('.json') ? 'JSON' :
                        activeFileName?.endsWith('.md') ? 'Markdown' : 'Text',
                isTerminalActive: true
            }}
        />
    );
};
