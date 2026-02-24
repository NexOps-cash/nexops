
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
    FileCode, Zap, Cpu, Loader2
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
import { FlowGraph } from '../components/flow/FlowGraph';
import { ExecutionPreview } from '../components/flow/ExecutionPreview';

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
    onNavigateHome: () => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({ project, onUpdateProject, walletConnected, onConnectWallet, onNavigateHome }) => {
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

    // Micro-animations State
    const [isBuilding, setIsBuilding] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

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
        return newVersion;
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

            setIsBuilding(true);
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
                    setTimeout(() => setIsBuilding(false), 800);

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
                    setIsBuilding(false);
                }

            } catch (e: any) {
                addLog('COMPILER', `Critical Error: ${e.message}`);
                console.error(e);
                setIsBuilding(false);
            }

        } else if (task === 'AUDIT') {
            setIsAuditing(true);
            setActiveTerminalChannel('AUDITOR');
            await handleRunAudit();
            setIsAuditing(false);
        } else if (task === 'TEST') {
            setActiveTerminalChannel('SYSTEM');
            addLog('SYSTEM', `Running local tests for ${mainContractFile?.name}...`);
            setTimeout(() => {
                addLog('SYSTEM', `✓ 4/4 Tests passed.`);
            }, 600);
        } else if (task === 'DEPLOY') {
            setIsDeploying(true);
            setActiveTerminalChannel('COMPILER');
            handleDeploy();
            setTimeout(() => {
                setIsDeploying(false);
                setActiveView('DEPLOY');
            }, 400);
        }
    };

    // -- Render Helpers --


    const renderSidebarExplorer = () => (
        <div className="flex-1 overflow-y-auto no-scrollbar py-0">
            <div className="px-4 py-3 bg-black/20 border-b border-white/5 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{project.name}</span>
            </div>
            <div className="space-y-0.5">
                {uniqueFiles.map(file => {
                    const isCashFile = file.name.endsWith('.cash');
                    const isActive = activeFileName === file.name;
                    return (
                        <button
                            key={file.name}
                            onClick={() => setActiveFileName(file.name)}
                            className={`w-full flex items-center space-x-3 px-4 py-2 text-xs transition-all relative truncate group ${isActive
                                ? 'text-white bg-nexus-cyan/5 font-bold'
                                : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                                }`}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-nexus-cyan rounded-r shadow-[0_0_10px_rgba(6,182,212,0.4)]"></div>
                            )}
                            <div className={`flex-shrink-0 transition-colors ${isActive ? 'text-nexus-cyan' : 'group-hover:text-slate-400'}`}>
                                {getFileIcon(file.name)}
                            </div>
                            <span className={`truncate ${isCashFile ? 'font-mono tracking-tight' : ''}`}>
                                {file.name}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="h-px bg-white/5 my-4" />

            <div className="px-4 mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">History Archives</span>
            </div>
            <div className="px-2 space-y-0.5">
                {(() => {
                    const fileVersions = project.versions.filter(v => v.fileName === activeFileName);
                    return fileVersions.slice(0, 10).map((v, idx) => {
                        const versionNumber = fileVersions.length - (fileVersions.indexOf(v));
                        const isSelected = compareVersion?.id === v.id;
                        return (
                            <div
                                key={v.id}
                                className={`flex items-center text-[9px] px-2 py-1.5 rounded cursor-pointer transition-colors ${isSelected
                                    ? 'bg-nexus-cyan/20 text-nexus-cyan'
                                    : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                                onClick={() => setCompareVersion(isSelected ? null : v)}
                            >
                                <History size={10} className="mr-2 shrink-0 opacity-60" />
                                <span className="truncate font-mono opacity-80">Snapshot v{versionNumber}</span>
                                <span className="ml-2 text-[8px] opacity-30 truncate">{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {v.author === 'AI' && <span className="ml-auto text-[7px] border border-purple-500/30 text-purple-400 px-1 rounded uppercase font-black">AI</span>}
                            </div>
                        );
                    });
                })()}
                {project.versions.filter(v => v.fileName === activeFileName).length === 0 && (
                    <div className="px-4 py-2 text-[9px] text-slate-700 italic">No historical traces available.</div>
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

    const renderSidebarDebug = () => {
        const artifactData = activeFile && isArtifactFile(activeFile) ? JSON.parse(activeFile.content) : null;

        return (
            <div className="flex flex-col h-full bg-[#0d1425]">
                {artifactData ? (
                    <ExecutionPreview artifact={artifactData} securityScore={project.auditReport?.score} />
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 h-full">
                        <Wand2 className="w-8 h-8 opacity-20 mb-3" />
                        <span className="text-xs uppercase tracking-widest font-black">No Compilation Artifact</span>
                        <p className="text-[10px] mt-2 opacity-60">Compile a contract to view its deterministic structure.</p>
                    </div>
                )}
            </div>
        );
    };

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
                    network={project.chain === 'BCH Testnet' ? 'testnet' : 'mainnet'}
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
            onArtifactsGenerated={(addr, artifact, args) => {
                setDeployedAddress(addr);
                setDeployedArtifact(artifact);
                setConstructorArgs(args);
                // We DON'T auto-navigate here, let them finish the success modal flow or fund
            }}
            onDeployed={(addr, artifact, args) => {
                setDeployedAddress(addr);
                setDeployedArtifact(artifact);
                setConstructorArgs(args);
                setActiveView('INTERACT'); // Auto-navigate to Interact ONLY on confirmed funding
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
            <div className="p-4 bg-black/20">
                <Button variant="primary" className="w-full text-xs font-bold uppercase tracking-widest py-2.5 h-auto">
                    <Play size={14} className="mr-2" /> Visualize Contract Structure
                </Button>
            </div>
            <div className="flex-1 p-4 text-xs text-slate-400">
                <p>Clicking the button above will render the deterministic structure based on the artifact ABI.</p>
            </div>
        </div>
    );

    const renderEditorArea = () => {
        const artifactFile = (activeFile && isArtifactFile(activeFile)) ? activeFile : project.files.find(f => isArtifactFile(f));
        const artifactData = artifactFile ? JSON.parse(artifactFile.content) : null;
        const auditScore = project.auditReport?.score || 0;
        const auditStatus = auditScore > 0.8 ? 'CLEAN' : auditScore > 0.5 ? 'WARNINGS' : project.auditReport ? 'CRITICAL' : 'UNAUDITED';
        const auditColor = auditStatus === 'CLEAN' ? 'text-green-500 border-green-500/30' : auditStatus === 'WARNINGS' ? 'text-yellow-500 border-yellow-500/30' : auditStatus === 'CRITICAL' ? 'text-red-500 border-red-500/30' : 'text-slate-600 border-white/5';

        return (
            <div className="flex flex-col h-full overflow-hidden bg-[#0f172a]">


                {/* Tabs */}
                <div className="h-9 flex items-center bg-[#0d1425] border-b border-white/5 px-0 shrink-0">
                    {uniqueFiles.map(file => (
                        <button
                            key={file.name}
                            onClick={() => setActiveFileName(file.name)}
                            className={`flex items-center space-x-2 px-3 h-full text-[11px] font-medium border-r border-white/5 transition-all relative ${activeFileName === file.name
                                ? 'bg-[#0f172a] text-white'
                                : 'text-slate-500 hover:bg-white/5'
                                }`}
                        >
                            {activeFileName === file.name && <div className="absolute top-0 left-0 right-0 h-0.5 bg-nexus-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]" />}
                            <span className="shrink-0">{getFileIcon(file.name)}</span>
                            <span className={`truncate max-w-[120px] ${file.name.endsWith('.cash') ? 'font-mono text-[10px]' : ''}`}>{file.name}</span>
                            {unsavedChanges && activeFileName === file.name && <div className="w-1.5 h-1.5 rounded-full bg-nexus-warning ml-1 shrink-0"></div>}
                        </button>
                    ))}
                </div>

                {/* Primary Action Bar */}
                <div className="h-10 bg-[#0d1425] border-b border-nexus-700/50 flex items-center px-4 space-x-2 shrink-0">
                    <button
                        onClick={() => handleRunTask('COMPILE')}
                        disabled={isBuilding}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-md transition-all text-xs font-bold uppercase tracking-wider group 
                            ${isBuilding ? 'bg-nexus-cyan/20 text-nexus-cyan border-nexus-cyan/50 opacity-80 cursor-wait' : 'bg-nexus-cyan/10 hover:bg-nexus-cyan/20 text-nexus-cyan border-nexus-cyan/30'}`}
                    >
                        {isBuilding ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} className="group-active:scale-90 transition-transform" />}
                        <span>{isBuilding ? 'Building' : 'Build'}</span>
                    </button>
                    <button
                        onClick={() => handleRunTask('TEST')}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-all text-xs font-bold uppercase tracking-wider group"
                    >
                        <Play size={14} className="group-active:scale-90 transition-transform" />
                        <span>Test</span>
                    </button>
                    <button
                        onClick={() => handleRunTask('AUDIT')}
                        disabled={isAuditing}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-md transition-all text-xs font-bold uppercase tracking-wider group 
                            ${isAuditing ? 'bg-nexus-pink/20 text-nexus-pink border-nexus-pink/50 opacity-80 cursor-wait' : 'bg-nexus-pink/10 hover:bg-nexus-pink/20 text-nexus-pink border-nexus-pink/30'}`}
                    >
                        {isAuditing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} className="group-active:scale-90 transition-transform" />}
                        <span>{isAuditing ? 'Auditing' : 'Audit'}</span>
                    </button>
                    <button
                        onClick={() => {
                            setIsDeploying(true);
                            setTimeout(() => {
                                setIsDeploying(false);
                                setActiveView('DEPLOY');
                            }, 400); // Micro delay for interaction feel
                        }}
                        disabled={isDeploying}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 border rounded-md transition-all text-xs font-bold uppercase tracking-wider group ml-1 
                            ${isDeploying ? 'bg-purple-500/20 text-purple-400 border-purple-500/50 opacity-80 cursor-wait' : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/30'}`}
                    >
                        {isDeploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} className="group-active:scale-90 transition-transform" />}
                        <span>Deploy</span>
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => {
                            if (unsavedChanges) {
                                handleSave();
                                setJustSaved(true);
                                setTimeout(() => setJustSaved(false), 1500);
                            }
                        }}
                        disabled={!unsavedChanges && !justSaved}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all text-xs font-bold uppercase tracking-wider group overflow-hidden
                            ${justSaved ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                                unsavedChanges ? 'bg-nexus-warning/10 hover:bg-nexus-warning/20 text-nexus-warning border border-nexus-warning/30' :
                                    'bg-slate-800/50 text-slate-500 border border-transparent'}`}
                    >
                        {justSaved ? (
                            <CheckCircle size={14} className="text-green-400 animate-[pulse_0.5s_ease-out]" />
                        ) : (
                            <Save size={14} className={unsavedChanges ? 'group-active:scale-90 transition-transform' : ''} />
                        )}
                        <span>{justSaved ? 'Saved' : 'Save'}</span>
                    </button>
                </div>

                {/* Editor Content */}
                <div className="flex-1 relative min-h-0">
                    {compareVersion && activeFile && (!compareVersion.fileName || compareVersion.fileName === activeFile.name) ? (
                        <>
                            <div className="absolute top-2 right-4 z-50">
                                <button
                                    onClick={() => setCompareVersion(null)}
                                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600/50 hover:border-slate-500 rounded-md shadow-xl transition-all text-xs font-bold uppercase tracking-wider group"
                                >
                                    <X size={14} className="group-active:scale-90 transition-transform" />
                                    <span>Exit Diff</span>
                                </button>
                            </div>
                            <MonacoEditorWrapper
                                key={`${activeFile.name}-diff`}
                                code={compareVersion.code}
                                originalCode={(() => {
                                    const fileVersions = project.versions.filter(v => v.fileName === activeFile.name);
                                    const idx = fileVersions.findIndex(v => v.id === compareVersion.id);
                                    if (idx !== -1 && idx + 1 < fileVersions.length) {
                                        return fileVersions[idx + 1].code;
                                    }
                                    return '';
                                })()}
                                language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                                diffMode={true}
                                onChange={() => { }}
                                readOnly={true}
                            />
                        </>
                    ) : activeView === 'FLOW' ? (
                        artifactData ? (
                            <FlowGraph artifact={artifactData} />
                        ) : (
                            <div className="flex items-center justify-center p-8 text-center text-slate-500 h-full">
                                <Wand2 className="w-8 h-8 opacity-20 mb-3" />
                                <span className="text-xs uppercase tracking-widest font-black">No Compilation Artifact</span>
                            </div>
                        )
                    ) : activeFile ? (
                        (activeFile && isArtifactFile(activeFile)) ? (
                            <ArtifactInspector
                                artifact={JSON.parse(activeFile.content)}
                                onDeploy={() => {
                                    setDeployedArtifact(JSON.parse(activeFile.content));
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
                        <div className="flex flex-col items-center justify-center h-full text-slate-700 font-mono space-y-2 select-none opacity-40">
                            <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                            <div className="text-[10px] tracking-widest uppercase font-black">Secure Workspace Initialized</div>
                            <div className="flex flex-col items-start space-y-1 text-[9px]">
                                <span>// Network: BCH Mainnet</span>
                                <span>// Deterministic Execution: Enabled</span>
                                <span>// Audit Engine: TollGate v0.3</span>
                            </div>
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
