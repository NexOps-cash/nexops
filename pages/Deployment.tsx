import React, { useState } from 'react';
import { Card, Button, Badge, CodeBlock } from '../components/UI';
import { Project, ChainType } from '../types';
import { compileCashScript, verifyDeterminism, ContractArtifact } from '../services/compilerService';
import { Rocket, Server, AlertCircle, CheckCircle, Copy, ShieldAlert, FileCode, Lock, Layout, Repeat } from 'lucide-react';

interface DeploymentProps {
    project: Project | null;
    walletConnected: boolean;
}

export const Deployment: React.FC<DeploymentProps> = ({ project, walletConnected }) => {
    const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.BCH_TESTNET);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentStep, setDeploymentStep] = useState(0); // 0: Idle, 1: Compiling, 2: Signing, 3: Broadcasting, 4: Success
    const [txHash, setTxHash] = useState<string | null>(null);

    // Artifact State
    const [artifact, setArtifact] = useState<ContractArtifact | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationError, setCompilationError] = useState<string | null>(null);
    const [isDeterminismVerified, setIsDeterminismVerified] = useState(false);

    if (!project) return <div className="p-8 text-center text-gray-500">No project selected.</div>;

    const auditScore = project.auditReport?.score || 0;
    const isAuditPassed = auditScore >= 80;

    const handlePrepare = async () => {
        setIsCompiling(true);
        setCompilationError(null);
        setArtifact(null);
        setIsDeterminismVerified(false);

        try {
            // 1. Compile
            await new Promise(r => setTimeout(r, 500)); // UI flush
            const result = compileCashScript(project.contractCode);

            if (!result.success || !result.artifact) {
                setCompilationError(result.errors.join('\n'));
                setIsCompiling(false);
                return;
            }

            // 2. Determinism Check (Re-compile and verify)
            const isDeterministic = await verifyDeterminism(project.contractCode, result.artifact.bytecode);

            if (!isDeterministic) {
                setCompilationError("CRITICAL: Determinism check failed. Bytecode output is not reproducible.");
                setIsCompiling(false);
                return;
            }

            setArtifact(result.artifact);
            setIsDeterminismVerified(true);

        } catch (e: any) {
            setCompilationError(e.message);
        } finally {
            setIsCompiling(false);
        }
    };

    const handleDeploy = () => {
        if (!walletConnected || !isAuditPassed || !artifact) return;
        setIsDeploying(true);
        setDeploymentStep(1);

        // Mock Deployment Process
        setTimeout(() => setDeploymentStep(2), 1500); // Signing
        setTimeout(() => setDeploymentStep(3), 3000); // Broadcasting
        setTimeout(() => {
            setDeploymentStep(4);
            setTxHash("0x7f9a...3b21");
            setIsDeploying(false);
        }, 5000);
    };

    // Helper to format Script Hash as "Address-like" for preview
    const formatAddressPreview = (sh: string) => `bchtest:p${sh.substring(0, 36)}...`;

    return (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
            {/* Left Column: Config & Artifacts */}
            <div className="lg:col-span-7 space-y-6">
                <Card>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                        <Server className="w-5 h-5 mr-2 text-nexus-purple" />
                        Network & Compiler
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Target Network</label>
                            <div className="bg-nexus-900 border border-nexus-700 text-gray-300 rounded px-3 py-2 text-sm">
                                Bitcoin Cash (Chipnet)
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Optimization</label>
                            <div className="bg-nexus-900 border border-nexus-700 text-gray-300 rounded px-3 py-2 text-sm">
                                Enabled (Runs: 200)
                            </div>
                        </div>
                    </div>

                    {!artifact ? (
                        <div className="text-center py-8 bg-nexus-900/30 rounded border border-dashed border-nexus-700">
                            <Button onClick={handlePrepare} isLoading={isCompiling} icon={<FileCode className="w-4 h-4" />}>
                                Prepare Deployment Artifacts
                            </Button>
                            {compilationError && (
                                <div className="mt-4 p-3 bg-red-900/20 text-red-400 text-sm border border-red-800 rounded text-left whitespace-pre-wrap">
                                    {compilationError}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between bg-green-900/10 border border-green-800 p-2 rounded px-3">
                                <span className="text-green-400 text-xs font-bold flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1.5" /> Compiled Successfully
                                </span>
                                {isDeterminismVerified && (
                                    <span className="text-nexus-cyan text-xs font-bold flex items-center" title="Re-compiled and verified bytecode consistency">
                                        <Repeat className="w-3 h-3 mr-1.5" /> Determinism Verified
                                    </span>
                                )}
                            </div>

                            {/* Artifact Preview Details */}
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center">
                                    <Lock className="w-3 h-3 mr-1" /> Locking Address (Preview)
                                </label>
                                <div className="font-mono text-xs bg-nexus-900 p-2 rounded text-nexus-cyan truncate border border-nexus-700">
                                    {artifact.scriptHash ? formatAddressPreview(artifact.scriptHash) : "Thinking..."}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center">
                                    <FileCode className="w-3 h-3 mr-1" /> Locking Bytecode
                                </label>
                                <div className="font-mono text-[10px] bg-black p-2 rounded text-gray-500 break-all border border-nexus-800 max-h-24 overflow-y-auto">
                                    {artifact.bytecode}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center">
                                    <Layout className="w-3 h-3 mr-1" /> Parameter Layout
                                </label>
                                <div className="bg-nexus-900 border border-nexus-700 rounded overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-nexus-800 text-gray-400">
                                            <tr>
                                                <th className="p-2">Name</th>
                                                <th className="p-2">Type</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-gray-300">
                                            {artifact.constructorInputs.length === 0 && (
                                                <tr><td colSpan={2} className="p-2 text-center text-gray-500 italic">No constructor parameters</td></tr>
                                            )}
                                            {artifact.constructorInputs.map((input, i) => (
                                                <tr key={i} className="border-t border-nexus-800">
                                                    <td className="p-2 font-mono text-nexus-cyan">{input.name}</td>
                                                    <td className="p-2 font-mono text-yellow-500">{input.type}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <Button size="sm" variant="secondary" onClick={handlePrepare} className="w-full" icon={<Repeat className="w-3 h-3" />}>
                                Re-Compile
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Right Column: Actions */}
            <div className="lg:col-span-5 space-y-6">
                <Card>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                        <Rocket className="w-5 h-5 mr-2 text-nexus-cyan" />
                        Deployment Action
                    </h3>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-nexus-800 p-3 rounded border border-nexus-700">
                            <div className="text-sm">
                                <p className="text-gray-400">Contract Name</p>
                                <p className="font-mono text-white truncate max-w-[150px]">{project.name}</p>
                            </div>
                            <Badge variant={isAuditPassed ? 'success' : 'high'}>
                                Audit: {project.auditReport?.score || 'N/A'}
                            </Badge>
                        </div>

                        {!isAuditPassed ? (
                            <div className="p-4 bg-red-900/10 border border-red-900/50 rounded text-center">
                                <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                <h4 className="text-red-400 font-bold mb-1">Deployment Blocked</h4>
                                <p className="text-xs text-red-300">
                                    Security score is below 80/100. <br />
                                    Return to Auditor to fix vulnerabilities.
                                </p>
                            </div>
                        ) : !walletConnected ? (
                            <div className="text-center p-4 bg-nexus-900/50 border border-nexus-700 rounded">
                                <AlertCircle className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-300 mb-2">Wallet not connected</p>
                                <Button variant="secondary" className="w-full">Connect Wallet</Button>
                            </div>
                        ) : !artifact ? (
                            <div className="text-center p-4 bg-nexus-900/50 border border-nexus-700 rounded">
                                <FileCode className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                <p className="text-sm text-gray-300">Artifacts not ready. Prepare deployment first.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {artifact.constructorInputs.length > 0 && (
                                    <div className="p-3 bg-yellow-900/10 border border-yellow-900/30 rounded text-xs text-yellow-500">
                                        ⚠️ Constructor arguments needed. (Mock: using defaults)
                                    </div>
                                )}
                                <Button
                                    onClick={handleDeploy}
                                    disabled={isDeploying || deploymentStep === 4}
                                    isLoading={isDeploying}
                                    className="w-full bg-nexus-cyan hover:bg-cyan-400 text-black font-bold"
                                >
                                    {deploymentStep === 4 ? "Deployed Successfully" : "Sign & Broadcast"}
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Console */}
                <Card className="font-mono text-sm bg-black border-nexus-700 min-h-[200px] flex flex-col">
                    <div className="border-b border-nexus-800 pb-2 mb-2 text-gray-500 uppercase text-xs">Deployment Log</div>
                    <div className="space-y-2 flex-1 overflow-y-auto">
                        <p className="text-gray-500">Waiting for command...</p>
                        {isCompiling && <p className="text-nexus-cyan">&gt; Compiling contract...</p>}
                        {artifact && <p className="text-green-500">&gt; Artifacts generated. Bytecode size: {artifact.bytecode.length / 2} bytes.</p>}
                        {deploymentStep >= 1 && <p className="text-nexus-cyan">&gt; Initiating deployment...</p>}
                        {deploymentStep >= 2 && <p className="text-nexus-cyan">&gt; Requesting wallet signature (WalletConnect)...</p>}
                        {deploymentStep >= 3 && <p className="text-nexus-cyan">&gt; Broadcasting transaction to Chipnet...</p>}
                        {deploymentStep >= 4 && (
                            <div className="mt-4 p-4 border border-green-900/50 bg-green-900/10 rounded">
                                <p className="text-green-400 flex items-center font-bold mb-2"><CheckCircle className="w-4 h-4 mr-2" /> Contract Deployed!</p>
                                <p className="text-gray-400">Transaction Hash:</p>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-white bg-nexus-800 px-2 py-1 rounded text-xs">{txHash}</span>
                                    <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};