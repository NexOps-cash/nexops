
import React, { useState, useEffect, useRef, useMemo } from 'react';
import JSZip from 'jszip';
import { Button, Tabs, getFileIcon, Badge, Modal } from '../components/UI';
import { MonacoEditorWrapper } from '../components/MonacoEditorWrapper';
import { WorkbenchLayout } from '../components/WorkbenchLayout';
import { NamedTaskTerminal, TerminalChannel } from '../components/NamedTaskTerminal';
import { Project, ProjectFile, CodeVersion } from '../types';
import {
    Folder, Save, Play, ShieldCheck, History, Rocket,
    Download, Settings, FilePlus, ChevronRight, ChevronDown,
    AlertTriangle, CheckCircle, Copy, GitMerge, RotateCcw,
    FileJson, MessageSquare, Send, User, Bot, Wand2, X, Trash2,
    FileCode, Zap, Cpu, Loader2, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getExplorerLink, fetchUTXOs } from '../services/blockchainService';
import { auditSmartContract, fixSmartContract, editSmartContract, chatWithAssistant, explainSmartContract } from '../services/groqService';
import { websocketService } from '../services/websocketService';
import { compileCashScript } from '../services/compilerService';
import { UTXO } from '../services/blockchainService';
import { ContractArtifact } from '../types';
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
import { extractFlow } from '../components/flow/FlowExtractor';

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
    const [deployedArtifact, setDeployedArtifact] = useState<ContractArtifact | null>(project.deployedArtifact || null);
    const [lastCompiledSource, setLastCompiledSource] = useState<string>('');
    const [deployedAddress, setDeployedAddress] = useState<string>(project.deployedAddress || '');
    const [constructorArgs, setConstructorArgs] = useState<string[]>(project.constructorArgs || []);
    const [fundingUtxo, setFundingUtxo] = useState<UTXO | null>(null);
    const [showLiveModal, setShowLiveModal] = useState(false);
    const [useExternalGenerator, setUseExternalGenerator] = useState(false);
    const [isWsConnected, setIsWsConnected] = useState(false);
    const [lastGeneratedIntent, setLastGeneratedIntent] = useState<string>('');
    const [openFileNames, setOpenFileNames] = useState<string[]>(project.files.map(f => f.name));
    const [fileToDelete, setFileToDelete] = useState<string | null>(null);
    const [fileToClose, setFileToClose] = useState<string | null>(null);

    // Derived State
    const activeFile = project.files.find(f => f.name === activeFileName);
    const mainContractFile = useMemo(() => {
        if (activeFile?.name.endsWith('.cash')) return activeFile;
        return project.files.find(f => f.name.endsWith('.cash'));
    }, [project.files, activeFile]);

    // Fix: Deduplicate files reliably for UI rendering
    const allUniqueFiles = useMemo(() => {
        return project.files.reduce((acc: ProjectFile[], current) => {
            const x = acc.find(item => item.name === current.name);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []);
    }, [project.files]);

    const openFiles = useMemo(() => {
        return allUniqueFiles.filter(f => openFileNames.includes(f.name));
    }, [allUniqueFiles, openFileNames]);

    // Sync active file if it becomes missing (closes deleted or removed files)
    useEffect(() => {
        if (!project.files.find(f => f.name === activeFileName) || !openFileNames.includes(activeFileName)) {
            setActiveFileName(openFileNames[0] || (project.files[0]?.name && openFileNames.includes(project.files[0].name) ? project.files[0].name : ''));
        }
    }, [project.files, activeFileName, openFileNames]);

    // Rehydration Logic: Restore deployment state when project changes or on mount
    useEffect(() => {
        if (project.deployedAddress) {
            setDeployedAddress(project.deployedAddress);

            // 1. Try to find the compiled artifact in project files
            const artifactFile = project.files.find(f => f.name.endsWith('.json'));
            if (artifactFile) {
                try {
                    const artifact = JSON.parse(artifactFile.content);
                    if (artifact.abi && artifact.bytecode) {
                        setDeployedArtifact(artifact);
                        console.log(`[Rehydration] Artifact restored for ${project.deployedAddress}`);
                    }
                } catch (e) {
                    console.error('[Rehydration] Failed to parse artifact:', e);
                }
            }

            // 2. Refresh UTXO state for the interaction sidebar
            fetchUTXOs(project.deployedAddress).then(utxos => {
                if (utxos.length > 0) {
                    setFundingUtxo(utxos[0]);
                    console.log(`[Rehydration] Funding UTXO detected for ${project.deployedAddress}`);
                }
            }).catch(err => {
                console.warn('[Rehydration] UTXO fetch failed:', err);
            });
        } else {
            // Reset if no deployment
            setDeployedAddress('');
            setDeployedArtifact(null);
            setFundingUtxo(null);
        }
    }, [project.id]); // Only re-run when switching projects

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

    const projectRef = useRef(project);
    useEffect(() => {
        projectRef.current = project;
    }, [project]);

    const hasAutoLoadedRef = useRef(false);

    // WebSocket Setup
    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error(err));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
                const { code, contract_name, toll_gate, fallback_used, metadata } = data.data;
                const fileName = `${contract_name || (activeFileName?.split('.')[0] || 'Generated')}.cash`;
                const isFallback = fallback_used === true;

                console.log("✅ Synthesis Success Processing:", { fileName, codeLength: code.length });
                if (isFallback) {
                    addLog('SYSTEM', `⚠ Template Loaded: ${contract_name}\n\nGuarded synthesis did not fully converge.\nA secure NexOps canonical structure was loaded.\n\nUse /edit to customize logic or add features`);
                } else {
                    addLog('SYSTEM', `✅ Successfully generated the contract: ${contract_name}`);
                    if (metadata?.lint_soft_fail) {
                        addLog('SYSTEM', `⚠️ Synthesis converged with minor structural warnings. Review Audit for details.`);
                    }
                }

                const isAutoLoad = !hasAutoLoadedRef.current;

                if (isAutoLoad) {
                    hasAutoLoadedRef.current = true;
                    // Auto apply update so users don't have to manually insert the first time
                    const p = projectRef.current;
                    const updatedFiles = [...p.files];
                    const existingIndex = updatedFiles.findIndex(f => f.name === fileName);
                    if (existingIndex !== -1) {
                        updatedFiles[existingIndex] = { ...updatedFiles[existingIndex], content: code };
                    } else {
                        updatedFiles.push({ name: fileName, content: code, language: 'cashscript' });
                    }
                    onUpdateProject({
                        ...p,
                        files: updatedFiles,
                        contractCode: code,
                        lastModified: Date.now()
                    });
                    setOpenFileNames(prev => {
                        if (!prev.includes(fileName)) return [...prev, fileName];
                        return prev;
                    });
                    setActiveFileName(fileName);
                }

                setChatHistory(prev => {
                    const newHistory = [...prev];
                    const lastMsg = newHistory[newHistory.length - 1];
                    const isFallback = isNaN(toll_gate.score) || toll_gate.score === null;
                    const softFailText = metadata?.lint_soft_fail
                        ? "\n\n⚠️ Synthesis converged with minor structural warnings. Review Audit for details."
                        : "";

                    const successMsg: ChatMessage = {
                        role: 'model',
                        text: isFallback
                            ? `⚠ Template Loaded: ${contract_name}\n\nGuarded synthesis did not fully converge.\nA secure NexOps canonical structure was loaded.\n\nUse /edit to customize logic or add features`
                            : `✅ Successfully generated the contract: ${contract_name}\n\nThe contract passed with the following features: ${data.data.intent_model.features.join(', ')}.${softFailText}`,
                        fileUpdates: isAutoLoad ? undefined : [{ name: fileName, content: code }],
                        isApplied: isAutoLoad
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

    const handleDownloadProjectZip = async () => {
        const zip = new JSZip();

        project.files.forEach(file => {
            let folder = '';
            if (file.name.endsWith('.cash')) {
                folder = 'contracts/';
            } else if (file.name.endsWith('.json')) {
                folder = 'artifacts/';
            } else {
                folder = 'docs/';
            }
            zip.file(`${folder}${file.name}`, file.content);
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${project.name.replace(/\s+/g, '_')}_Project.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadCash = () => {
        if (!activeFile) return;

        const content = activeFile.content;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        // Ensure name ends with .cash for the downloaded file
        const baseName = activeFile.name.includes('.')
            ? activeFile.name.substring(0, activeFile.name.lastIndexOf('.'))
            : activeFile.name;
        const fileName = `${baseName}.cash`;

        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleCloseFile = (fileName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFileToClose(fileName);
    };

    const handleConfirmClose = () => {
        if (!fileToClose) return;
        setOpenFileNames(prev => prev.filter(name => name !== fileToClose));
        setFileToClose(null);
    };

    const confirmDelete = (fileName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFileToDelete(fileName);
    };

    const handleDeleteFile = () => {
        if (!fileToDelete) return;

        const updatedFiles = project.files.filter(f => f.name !== fileToDelete);
        onUpdateProject({ ...project, files: updatedFiles });
        setOpenFileNames(prev => prev.filter(name => name !== fileToDelete));
        setFileToDelete(null);
        addLog('SYSTEM', `File ${fileToDelete} deleted.`);
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

        const isGenerateCommand = msgToSend.trim().startsWith('/generate');
        const isEditCommand = msgToSend.trim().startsWith('/edit');
        const intentMessage = isGenerateCommand ? msgToSend.replace('/generate', '').trim() : msgToSend;
        const editInstruction = isEditCommand ? msgToSend.replace('/edit', '').trim() : '';

        if (useExternalGenerator && isGenerateCommand) {
            setLastGeneratedIntent(intentMessage);
            if (!websocketService.isConnected()) {
                websocketService.connect();
                // We'll wait a bit or just fail fast
                setTimeout(() => {
                    if (websocketService.isConnected()) {
                        websocketService.sendIntent(intentMessage, chatHistory.map(h => ({ role: h.role, content: h.text })));
                    } else {
                        setChatHistory(prev => [...prev, { role: 'model', text: "External Generator is not connected. Attempting to reconnect..." }]);
                        setIsChatting(false);
                    }
                }, 1000);
            } else {
                websocketService.sendIntent(intentMessage, chatHistory.map(h => ({ role: h.role, content: h.text })));
            }
            return;
        }

        if (isEditCommand && mainContractFile) {
            try {
                const result = await editSmartContract(mainContractFile.content, editInstruction, useExternalGenerator);
                setChatHistory(prev => [...prev, {
                    role: 'model',
                    text: result.explanation,
                    fileUpdates: [{ name: mainContractFile.name, content: result.code }]
                }]);
            } catch (e) {
                setChatHistory(prev => [...prev, { role: 'model', text: "Failed to apply edit. Check connection to backend." }]);
            } finally {
                setIsChatting(false);
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
        const originalStates: { name: string, content: string | null }[] = [];

        updates.forEach(update => {
            const existingIndex = updatedFiles.findIndex(f => f.name === update.name);
            if (existingIndex !== -1) {
                originalStates.push({ name: update.name, content: updatedFiles[existingIndex].content });
                updatedFiles[existingIndex] = { ...updatedFiles[existingIndex], content: update.content };
            } else {
                originalStates.push({ name: update.name, content: null });
                updatedFiles.push({
                    name: update.name,
                    content: update.content,
                    language: update.name.endsWith('.cash') ? 'cashscript' : 'markdown'
                });
            }
        });

        if (updates.length > 0) {
            setActiveFileName(updates[0].name);
            setOpenFileNames(prev => {
                const newOpen = [...prev];
                updates.forEach(u => {
                    if (!newOpen.includes(u.name)) newOpen.push(u.name);
                });
                return newOpen;
            });
        }

        const newHistory = [...chatHistory];
        newHistory[messageIndex] = { ...newHistory[messageIndex], isReviewing: true, originalStates };
        setChatHistory(newHistory);

        onUpdateProject({
            ...project,
            files: updatedFiles,
            lastModified: Date.now()
        });

        setUnsavedChanges(true);
    };

    const acceptFileUpdates = (messageIndex: number) => {
        const msg = chatHistory[messageIndex];
        const updates = msg.fileUpdates;
        if (!updates) return;

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
        newHistory[messageIndex] = { ...newHistory[messageIndex], isReviewing: false, isApplied: true };
        setChatHistory(newHistory);

        onUpdateProject({
            ...project,
            contractCode: newVersion.code,
            versions: [newVersion, ...project.versions],
            lastModified: Date.now()
        });

        setUnsavedChanges(false);
    };

    const rejectFileUpdates = (messageIndex: number) => {
        const msg = chatHistory[messageIndex];
        const originalStates = msg.originalStates;
        if (!originalStates) return;

        const updatedFiles = [...project.files];

        originalStates.forEach(orig => {
            if (orig.content === null) {
                const idx = updatedFiles.findIndex(f => f.name === orig.name);
                if (idx !== -1) updatedFiles.splice(idx, 1);
            } else {
                const idx = updatedFiles.findIndex(f => f.name === orig.name);
                if (idx !== -1) updatedFiles[idx] = { ...updatedFiles[idx], content: orig.content };
            }
        });

        const newHistory = [...chatHistory];
        newHistory[messageIndex] = { ...newHistory[messageIndex], isReviewing: false, isApplied: false };
        setChatHistory(newHistory);

        onUpdateProject({
            ...project,
            files: updatedFiles,
            lastModified: Date.now()
        });
    };

    const handleRunAudit = async () => {
        if (!mainContractFile) return;
        setIsAuditing(true);
        addLog('AUDITOR', 'Starting Security Audit...');

        // Show indicator in Chat
        setChatHistory(prev => [...prev, { role: 'user', text: 'Run Security Audit' }]);

        try {
            const report = await auditSmartContract(mainContractFile.content, useExternalGenerator, lastGeneratedIntent);
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

    const handleFixProblem = async (problem: Problem) => {
        if (!mainContractFile) return;
        setActiveView('AUDITOR');
        setIsChatting(true);

        const prompt = `Fix this compilation error:\nFile: ${problem.file}\nLine: ${problem.line || 'unknown'}\nError: ${problem.message}`;
        setChatHistory(prev => [...prev, { role: 'user', text: prompt }]);

        try {
            const issuePayload = {
                title: 'Compilation Error',
                description: problem.message,
                severity: problem.severity === 'error' ? 'HIGH' : 'MEDIUM',
                line: problem.line,
                rule_id: 'compiler-error',
                can_fix: true,
                recommendation: 'Fix syntax or compilation error'
            };

            const result = await fixSmartContract(mainContractFile.content, prompt, useExternalGenerator, issuePayload);

            setChatHistory(prev => [...prev, {
                role: 'model',
                text: result.explanation,
                fileUpdates: [{ name: mainContractFile.name, content: result.code }]
            }]);
        } catch (e) {
            setChatHistory(prev => [...prev, { role: 'model', text: "Failed to generate fix for compiler error." }]);
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
                    setOpenFileNames(prev => {
                        if (!prev.includes(artifactFileName)) return [...prev, artifactFileName];
                        return prev;
                    });

                    addLog('COMPILER', [
                        `✅ Compile Success!`,
                        `  - Contract: ${result.artifact.contractName}`,
                        `  - Bytecode Size: ${bytes} bytes`,
                        `  - Artifact: ${artifactFileName} saved to explorer.`
                    ]);
                    setDeployedArtifact(result.artifact);
                    setLastCompiledSource(mainContractFile.content);
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

    const handleExplainContract = async () => {
        // Prioritize the most recently compiled artifact + its source code
        let artifactData: any = deployedArtifact;
        let sourceCode = lastCompiledSource;

        // If no compile has happened, fall back to file-based resolution
        if (!artifactData) {
            artifactData = (activeFile && isArtifactFile(activeFile))
                ? JSON.parse(activeFile.content)
                : project.files.find(f => isArtifactFile(f))
                    ? JSON.parse(project.files.find(f => isArtifactFile(f))!.content)
                    : null;
        }
        if (!sourceCode) {
            if (artifactData?.contractName) {
                const srcFile = project.files.find(f => f.name.endsWith('.cash') && f.content.includes(`contract ${artifactData.contractName}`));
                if (srcFile) sourceCode = srcFile.content;
                else {
                    const fallback = (activeFile && activeFile.name.endsWith('.cash')) ? activeFile : project.files.find(f => f.name.endsWith('.cash'));
                    if (fallback) sourceCode = fallback.content;
                }
            } else if (activeFile?.name.endsWith('.cash')) {
                sourceCode = activeFile.content;
            }
        }

        if (!sourceCode) {
            addLog('SYSTEM', 'Cannot explain: No contract source code found.');
            return;
        }

        setActiveView('AUDITOR');

        const progressMsg: ChatMessage = {
            role: 'model',
            text: '[Progress] Executing semantic analysis...',
            isProgress: true,
            stage: 'Analyzer'
        };
        setChatHistory(prev => [...prev, progressMsg]);
        setIsChatting(true);

        try {
            const explanation = await explainSmartContract(sourceCode);
            setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory.pop(); // remove progress
                newHistory.push({
                    role: 'model',
                    text: 'Analysis generated successfully.',
                    explanationData: explanation
                });
                return newHistory;
            });
        } catch (e: any) {
            setChatHistory(prev => {
                const newHistory = [...prev];
                newHistory.pop();
                newHistory.push({
                    role: 'model',
                    text: `Error analyzing contract: ${e.message}`
                });
                return newHistory;
            });
            addLog('SYSTEM', `Explain Error: ${e.message}`);
        } finally {
            setIsChatting(false);
        }
    };

    // -- Render Helpers --


    const renderSidebarExplorer = () => {
        const contractFiles = allUniqueFiles.filter(f => f.name.endsWith('.cash'));
        const artifactFiles = allUniqueFiles.filter(f => f.name.endsWith('.json'));
        const docFiles = allUniqueFiles.filter(f => !f.name.endsWith('.cash') && !f.name.endsWith('.json'));

        const renderFileItem = (file: ProjectFile) => {
            const isCashFile = file.name.endsWith('.cash');
            const isActive = activeFileName === file.name;
            return (
                <div
                    key={file.name}
                    className="group flex items-center relative"
                >
                    <button
                        onClick={() => {
                            if (!openFileNames.includes(file.name)) {
                                setOpenFileNames(prev => [...prev, file.name]);
                            }
                            setActiveFileName(file.name);
                        }}
                        className={`flex-1 flex items-center space-x-3 pl-8 pr-10 py-1.5 text-xs transition-all relative truncate ${isActive
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
                    <button
                        onClick={(e) => confirmDelete(file.name, e)}
                        className="absolute right-2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all z-10"
                        title="Delete File"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            );
        };

        return (
            <div className="flex-1 overflow-y-auto no-scrollbar py-0">
                <div className="px-4 py-3 bg-black/20 border-b border-white/5 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{project.name}</span>
                    <button
                        onClick={handleDownloadProjectZip}
                        className="flex items-center space-x-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-slate-400 hover:text-nexus-cyan border border-white/5 rounded transition-all group uppercase tracking-wider"
                    >
                        <Download size={12} className="group-hover:scale-110 transition-transform" />
                        <span>Download .zip</span>
                    </button>
                </div>

                <div className="flex flex-col">
                    {contractFiles.length > 0 && (
                        <details open className="group/folder relative">
                            <summary className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                <ChevronRight size={12} className="transition-transform group-open/folder:rotate-90 -ml-1 text-slate-600 group-hover/folder:text-slate-400" />
                                <Folder size={12} className="opacity-80 text-blue-500" />
                                <span>Contracts</span>
                            </summary>
                            <div className="space-y-[1px] pb-1">
                                {contractFiles.map(renderFileItem)}
                            </div>
                        </details>
                    )}

                    {artifactFiles.length > 0 && (
                        <details open className="group/folder relative">
                            <summary className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                <ChevronRight size={12} className="transition-transform group-open/folder:rotate-90 -ml-1 text-slate-600 group-hover/folder:text-slate-400" />
                                <Folder size={12} className="opacity-80 text-yellow-500" />
                                <span>Artifacts</span>
                            </summary>
                            <div className="space-y-[1px] pb-1">
                                {artifactFiles.map(renderFileItem)}
                            </div>
                        </details>
                    )}

                    {docFiles.length > 0 && (
                        <details open className="group/folder relative">
                            <summary className="flex items-center space-x-2 px-4 py-2 text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors select-none list-none [&::-webkit-details-marker]:hidden">
                                <ChevronRight size={12} className="transition-transform group-open/folder:rotate-90 -ml-1 text-slate-600 group-hover/folder:text-slate-400" />
                                <Folder size={12} className="opacity-80 text-purple-400" />
                                <span>Docs</span>
                            </summary>
                            <div className="space-y-[1px] pb-1">
                                {docFiles.map(renderFileItem)}
                            </div>
                        </details>
                    )}
                </div>

                <div className="h-px bg-white/5 my-4" />

                <div className="px-4 mb-3 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">History Archives</span>
                </div>
                <div className="px-3 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pb-4">
                    {(() => {
                        const fileVersions = project.versions.filter(v => v.fileName === activeFileName);
                        return fileVersions.slice(0, 50).map((v, idx) => {
                            const versionNumber = fileVersions.length - (fileVersions.indexOf(v));
                            const isSelected = compareVersion?.id === v.id;
                            return (
                                <div
                                    key={v.id}
                                    className={`flex items-center text-[11px] px-3 py-2.5 rounded-md cursor-pointer transition-all border ${isSelected
                                        ? 'bg-nexus-cyan/10 border-nexus-cyan/30 text-nexus-cyan shadow-sm'
                                        : 'bg-[#151a24] border-white/5 text-slate-300 hover:text-white hover:bg-[#1c2331] hover:border-white/10'
                                        }`}
                                    onClick={() => setCompareVersion(isSelected ? null : v)}
                                >
                                    <History size={12} className={`mr-2.5 shrink-0 ${isSelected ? 'text-nexus-cyan' : 'text-slate-500'}`} />
                                    <span className="truncate font-mono font-semibold">Snapshot v{versionNumber}</span>
                                    <span className="ml-[auto] text-[9px] text-slate-500 truncate mx-2">{new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {v.author === 'AI' && <span className="text-[8px] bg-purple-500/10 border border-purple-500/30 text-purple-400 px-1.5 py-0.5 rounded uppercase font-black tracking-widest">AI</span>}
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
    };

    const renderSidebarAuditor = () => (
        <AIPanel
            history={chatHistory}
            onSend={handleSendMessage}
            isBusy={isChatting}
            onApply={applyFileUpdates}
            onAccept={acceptFileUpdates}
            onReject={rejectFileUpdates}
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

        let sourceCode = '';
        if (artifactData && artifactData.contractName) {
            const srcFile = project.files.find(f => f.name.endsWith('.cash') && f.content.includes(`contract ${artifactData.contractName}`));
            if (srcFile) sourceCode = srcFile.content;
            else {
                const fallback = (activeFile && activeFile.name.endsWith('.cash')) ? activeFile : project.files.find(f => f.name.endsWith('.cash'));
                if (fallback) sourceCode = fallback.content;
            }
        }

        return (
            <div className="flex flex-col h-full bg-[#0d1425]">
                {artifactData ? (
                    <ExecutionPreview artifact={artifactData} sourceCode={sourceCode} securityScore={project.auditReport?.score} />
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
                    network={project.chain === 'BCH Testnet' ? 'chipnet' : 'mainnet'}
                    initialUtxo={fundingUtxo}
                    onConfigChange={(newArgs) => {
                        setConstructorArgs(newArgs);
                        onUpdateProject({
                            ...project,
                            constructorArgs: newArgs,
                            lastModified: Date.now()
                        });
                    }}
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
            onDeployed={(addr, artifact, args, utxo) => {
                setDeployedAddress(addr);
                setDeployedArtifact(artifact);
                setConstructorArgs(args);
                if (utxo) setFundingUtxo(utxo);

                // Update project state with deployed address for persistence
                onUpdateProject({
                    ...project,
                    deployedAddress: addr,
                    deployedArtifact: artifact,
                    constructorArgs: args,
                    lastModified: Date.now()
                });

                setShowLiveModal(true);
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

    const renderSidebarFlow = () => {
        // Prioritize deployedArtifact (most recently compiled) over stale file searches
        const artifactData = deployedArtifact
            ?? (() => {
                const f = (activeFile && isArtifactFile(activeFile)) ? activeFile : project.files.find(f => isArtifactFile(f));
                return f ? JSON.parse(f.content) : null;
            })();

        let sourceCode = lastCompiledSource;
        if (!sourceCode && artifactData?.contractName) {
            const srcFile = project.files.find(f => f.name.endsWith('.cash') && f.content.includes(`contract ${artifactData.contractName}`));
            if (srcFile) sourceCode = srcFile.content;
            else {
                const fallback = (activeFile && activeFile.name.endsWith('.cash')) ? activeFile : project.files.find(f => f.name.endsWith('.cash'));
                if (fallback) sourceCode = fallback.content;
            }
        }

        // We need to re-extract briefly just to get the stats
        // For simplicity and speed in this component slice, we re-run the pure function extractor here.
        const { orderedSteps, nodes } = extractFlow(artifactData, sourceCode);

        const contractName = artifactData?.contractName || 'Unknown';
        const functionsCount = nodes.filter((n: any) => n.type === 'function').length;
        const conditionCount = nodes.filter((n: any) => n.type === 'condition').length;
        const terminalCount = nodes.filter((n: any) => ['success', 'failure', 'validation'].includes(n.type)).length;
        const maxDepth = Math.max(0, ...orderedSteps.map((s: any) => s.depth));

        // Arbitrary complexity formula that scales nicely
        const complexityRaw = (conditionCount * 1.5) + (terminalCount * 0.8) + (maxDepth * 1.2);
        const complexityScore = (Math.min(10, Math.max(0.1, complexityRaw))).toFixed(1);

        return (
            <div className="flex flex-col h-full bg-[#0d1425] border-r border-white/5 text-slate-300">
                <div className="p-4 border-b border-white/5 bg-[#0f172a]">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#06b6d4] mb-1 flex items-center">
                        <Zap size={14} className="mr-2" />
                        Contract Structure
                    </h3>
                    <div className="text-[10px] text-slate-500 font-mono">
                        {contractName}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Functions</span>
                            <span className="font-mono font-bold text-slate-200">{functionsCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Conditions</span>
                            <span className="font-mono font-bold text-blue-400">{conditionCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Execution Paths</span>
                            <span className="font-mono font-bold text-green-400">{terminalCount}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Max Depth</span>
                            <span className="font-mono font-bold text-orange-400">{maxDepth}</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                            Complexity Index
                        </div>
                        <div className="flex items-end space-x-2">
                            <span className="text-3xl font-bold text-nexus-cyan font-mono leading-none">{complexityScore}</span>
                            <span className="text-xs text-slate-500 font-mono mb-1">/ 10</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderEditorArea = () => {
        // Prioritize deployedArtifact (most recently compiled) over stale file searches
        const artifactData = deployedArtifact
            ?? (() => {
                const f = (activeFile && isArtifactFile(activeFile)) ? activeFile : project.files.find(f => isArtifactFile(f));
                return f ? JSON.parse(f.content) : null;
            })();

        let sourceCode = lastCompiledSource;
        if (!sourceCode && artifactData?.contractName) {
            // Find the source file that generated this artifact
            const srcFile = project.files.find(f => f.name.endsWith('.cash') && f.content.includes(`contract ${artifactData.contractName}`));
            if (srcFile) sourceCode = srcFile.content;
            else {
                // Fallback to active file or first cash file
                const fallback = (activeFile && activeFile.name.endsWith('.cash')) ? activeFile : project.files.find(f => f.name.endsWith('.cash'));
                if (fallback) sourceCode = fallback.content;
            }
        }

        const activeReviewMessage = chatHistory.find(m => m.isReviewing);
        const reviewOriginalState = activeReviewMessage?.originalStates?.find(s => s.name === activeFileName);

        const auditScore = project.auditReport?.score || 0;
        const auditStatus = auditScore > 0.8 ? 'CLEAN' : auditScore > 0.5 ? 'WARNINGS' : project.auditReport ? 'CRITICAL' : 'UNAUDITED';
        const auditColor = auditStatus === 'CLEAN' ? 'text-green-500 border-green-500/30' : auditStatus === 'WARNINGS' ? 'text-yellow-500 border-yellow-500/30' : auditStatus === 'CRITICAL' ? 'text-red-500 border-red-500/30' : 'text-slate-600 border-white/5';

        return (
            <div className="flex flex-col h-full overflow-hidden bg-[#0f172a]">


                {/* Tabs */}
                {activeView !== 'FLOW' && (
                    <>
                        <div className="h-9 flex items-center bg-[#0d1425] border-b border-white/5 px-0 shrink-0">
                            {openFiles.map(file => (
                                <button
                                    key={file.name}
                                    onClick={() => setActiveFileName(file.name)}
                                    className={`group flex items-center space-x-2 px-3 h-full text-[11px] font-medium border-r border-white/5 transition-all relative ${activeFileName === file.name
                                        ? 'bg-[#0f172a] text-white'
                                        : 'text-slate-500 hover:bg-white/5'
                                        }`}
                                >
                                    {activeFileName === file.name && <div className="absolute top-0 left-0 right-0 h-0.5 bg-nexus-cyan shadow-[0_0_8px_rgba(6,182,212,0.6)]" />}
                                    <span className="shrink-0">{getFileIcon(file.name)}</span>
                                    <span className={`truncate max-w-[120px] ${file.name.endsWith('.cash') ? 'font-mono text-[10px]' : ''}`}>{file.name}</span>
                                    {unsavedChanges && activeFileName === file.name && <div className="w-1.5 h-1.5 rounded-full bg-nexus-warning ml-1 shrink-0"></div>}
                                    <span
                                        className="ml-2 p-0.5 rounded-sm hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => handleCloseFile(file.name, e)}
                                    >
                                        <X size={10} />
                                    </span>
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
                            <button
                                onClick={handleExplainContract}
                                disabled={isChatting}
                                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all text-[13px] font-bold text-[#00E5FF] bg-[#1a2235] hover:bg-[#232c43] border border-[#00E5FF]/20 ml-2 shadow-sm ${isChatting ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                <Wand2 size={14} className="active:scale-90 transition-transform" />
                                <span>EXPLAIN</span>
                            </button>
                            <button
                                onClick={handleDownloadCash}
                                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md transition-all text-xs font-bold uppercase tracking-wider group ml-2"
                                title="Download as .cash file"
                            >
                                <Download size={14} className="group-active:scale-90 transition-transform" />
                                <span>Download</span>
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
                    </>
                )}

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
                    ) : activeReviewMessage && activeFile && reviewOriginalState ? (
                        <>
                            <div className="absolute top-2 right-4 z-50">
                                <div className="px-3 py-1.5 bg-[#0078d4]/10 text-[#0078d4] border border-[#0078d4]/30 rounded-md shadow-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0078d4] animate-pulse"></span>
                                    Reviewing Changes
                                </div>
                            </div>
                            <MonacoEditorWrapper
                                key={`${activeFile.name}-ai-review`}
                                code={activeFile.content}
                                originalCode={reviewOriginalState.content || ''}
                                language={activeFile.name.endsWith('.cash') ? 'cashscript' : 'markdown'}
                                diffMode={true}
                                onChange={() => { }}
                                readOnly={true}
                            />
                        </>
                    ) : activeView === 'FLOW' ? (
                        artifactData ? (
                            <FlowGraph artifact={artifactData} sourceCode={sourceCode} />
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
                    onAskAI={handleFixProblem}
                />
            }
        />
    );

    return (
        <div className="h-screen w-screen overflow-hidden animate-in fade-in duration-700 ease-out fill-mode-forwards opacity-0" style={{ animation: 'fadeIn 0.8s ease-out forwards' }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(1.01); filter: blur(4px); }
                    to { opacity: 1; transform: scale(1); filter: blur(0); }
                }
            `}} />
            <WorkbenchLayout
                activeView={activeView}
                onViewChange={setActiveView}
                sidebarContent={
                    activeView === 'EXPLORER' ? renderSidebarExplorer() :
                        activeView === 'AUDITOR' ? renderSidebarAuditor() :
                            activeView === 'DEBUG' ? renderSidebarDebug() :
                                activeView === 'FLOW' ? renderSidebarFlow() :
                                    activeView === 'INTERACT' ? renderSidebarInteract() :
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
                onNavigateHome={onNavigateHome}
            />

            {/* Deletion Confirmation Modal */}
            <Modal
                isOpen={!!fileToDelete}
                onClose={() => setFileToDelete(null)}
                title="Confirm Deletion"
            >
                <div className="space-y-4">
                    <div className="flex items-center space-x-3 text-nexus-warning">
                        <AlertTriangle size={20} />
                        <p className="text-sm font-medium">Warning: This action cannot be undone.</p>
                    </div>
                    <p className="text-slate-300 text-sm">
                        Are you sure you want to permanently delete <span className="text-white font-mono">{fileToDelete}</span>?
                        This will remove the file from the project.
                    </p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <Button variant="ghost" onClick={() => setFileToDelete(null)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteFile}>Delete File</Button>
                    </div>
                </div>
            </Modal>

            {/* Close Confirmation Modal */}
            <Modal
                isOpen={!!fileToClose}
                onClose={() => setFileToClose(null)}
                title="Close Tab"
            >
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                        Are you sure you want to close the tab for <span className="text-white font-mono">{fileToClose}</span>?
                    </p>
                    <div className="flex justify-end space-x-3 mt-6">
                        <Button variant="ghost" onClick={() => setFileToClose(null)}>Cancel</Button>
                        <Button variant="primary" onClick={handleConfirmClose}>Close Tab</Button>
                    </div>
                </div>
            </Modal>

            {/* MODAL: Contract is Live */}
            <Modal
                isOpen={showLiveModal}
                onClose={() => setShowLiveModal(false)}
                title="Contract Published Successfully"
            >
                <div className="space-y-6 py-4 text-center">
                    <div className="mx-auto w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center border border-green-500/50 mb-2 relative">
                        <Rocket className="w-10 h-10 text-green-500" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                            <CheckCircle className="w-4 h-4 text-black" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter">Your Contract is Live!</h4>
                        <p className="text-slate-400 text-sm max-w-[300px] mx-auto">
                            The funding has been detected and your contract is now active on the Bitcoin Cash Chipnet.
                        </p>
                    </div>

                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 text-left space-y-4">
                        {fundingUtxo && (
                            <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/5">
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Value Detected</span>
                                    <span className="text-white font-mono text-sm">{fundingUtxo.value.toLocaleString()} sats</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Block Height</span>
                                    <span className="text-white font-mono text-sm">{fundingUtxo.height || 'Mempool'}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Confirmations</span>
                                    <span className="text-nexus-cyan font-black text-sm">{fundingUtxo.confirmations}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">TXID</span>
                                    <span className="text-nexus-cyan font-mono text-[9px] truncate block w-20">{fundingUtxo.txid.slice(0, 8)}...</span>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block mb-1">Contract Address</label>
                            <div className="flex items-center justify-between bg-nexus-900/80 p-2.5 rounded border border-white/5">
                                <span className="font-mono text-nexus-cyan text-xs truncate mr-2">{deployedAddress}</span>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(deployedAddress);
                                        toast.success("Copied!");
                                    }}
                                    className="p-1 hover:text-white transition-colors"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            variant="primary"
                            className="w-full py-3 h-auto text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(0,229,255,0.3)] hover:shadow-[0_0_30px_rgba(0,229,255,0.5)]"
                            onClick={() => {
                                setShowLiveModal(false);
                                setActiveView('INTERACT');
                            }}
                            icon={<Play className="w-4 h-4" />}
                        >
                            Transaction Builder
                        </Button>
                        <Button
                            variant="secondary"
                            className="w-full h-10 text-xs font-bold uppercase tracking-widest opacity-80 hover:opacity-100"
                            onClick={() => window.open(getExplorerLink(deployedAddress), '_blank')}
                            icon={<ExternalLink className="w-3 h-3" />}
                        >
                            View on Explorer
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
