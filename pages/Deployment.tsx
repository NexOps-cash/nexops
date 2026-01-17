import React, { useState } from 'react';
import { Card, Button, Badge, Input } from '../components/UI';
import { Project, ChainType } from '../types';
import { Rocket, Server, AlertCircle, CheckCircle, Copy, ShieldAlert } from 'lucide-react';

interface DeploymentProps {
    project: Project | null;
    walletConnected: boolean;
}

export const Deployment: React.FC<DeploymentProps> = ({ project, walletConnected }) => {
    const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.BCH_TESTNET);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentStep, setDeploymentStep] = useState(0); // 0: Idle, 1: Compiling, 2: Signing, 3: Broadcasting, 4: Success
    const [txHash, setTxHash] = useState<string | null>(null);

    if (!project) return <div className="p-8 text-center text-gray-500">No project selected.</div>;

    const auditScore = project.auditReport?.score || 0;
    const isAuditPassed = auditScore >= 80;

    const handleDeploy = () => {
        if (!walletConnected || !isAuditPassed) return;
        setIsDeploying(true);
        setDeploymentStep(1);

        // Mock Deployment Process
        setTimeout(() => setDeploymentStep(2), 1500); // Compile
        setTimeout(() => setDeploymentStep(3), 3000); // Sign
        setTimeout(() => {
            setDeploymentStep(4);
            setTxHash("0x7f9a...3b21");
            setIsDeploying(false);
        }, 5000); // Broadcast
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                        <Server className="w-5 h-5 mr-2 text-nexus-purple" />
                        Network Configuration
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Target Blockchain</label>
                            <div className="relative">
                                <div className="w-full bg-nexus-900 border border-nexus-700 text-gray-500 rounded-lg px-4 py-2">
                                    Bitcoin Cash (Chipnet)
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-nexus-900/50 rounded border border-nexus-700">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-400">Gas Price (Est)</span>
                                <span className="text-gray-200">1.05 sats/byte</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Network Status</span>
                                <span className="text-green-400 flex items-center"><span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span> Healthy</span>
                            </div>
                        </div>
                    </div>
                </Card>

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
                                <p className="text-sm text-gray-300">Wallet not connected</p>
                            </div>
                        ) : (
                            <Button
                                onClick={handleDeploy}
                                disabled={isDeploying || deploymentStep === 4}
                                isLoading={isDeploying}
                                className="w-full"
                            >
                                {deploymentStep === 4 ? "Deployed Successfully" : "Deploy to Testnet"}
                            </Button>
                        )}
                    </div>
                </Card>
            </div>

            {/* Console / Status */}
            <Card className="font-mono text-sm bg-black border-nexus-700 min-h-[200px]">
                <div className="border-b border-nexus-800 pb-2 mb-2 text-gray-500 uppercase text-xs">Deployment Log</div>
                <div className="space-y-2">
                    <p className="text-gray-500">Waiting for command...</p>
                    {deploymentStep >= 1 && <p className="text-nexus-cyan">&gt; Compiling contract artifacts...</p>}
                    {deploymentStep >= 2 && <p className="text-nexus-cyan">&gt; Requesting wallet signature...</p>}
                    {deploymentStep >= 3 && <p className="text-nexus-cyan">&gt; Broadcasting transaction to {selectedChain}...</p>}
                    {deploymentStep >= 4 && (
                        <div className="mt-4 p-4 border border-green-900/50 bg-green-900/10 rounded">
                            <p className="text-green-400 flex items-center font-bold mb-2"><CheckCircle className="w-4 h-4 mr-2" /> Contract Deployed!</p>
                            <p className="text-gray-400">Transaction Hash:</p>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className="text-white bg-nexus-800 px-2 py-1 rounded">{txHash}</span>
                                <Copy className="w-4 h-4 text-gray-500 cursor-pointer hover:text-white" />
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};