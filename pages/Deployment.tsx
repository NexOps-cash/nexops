import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal } from '../components/UI';
import { Project, ChainType } from '../types';
import { compileCashScript, verifyDeterminism, ContractArtifact } from '../services/compilerService';
import { fixSmartContract } from '../services/groqService';
import { walletConnectService } from '../services/walletConnectService';
import { deriveContractAddress } from '../services/addressService';
import { Network } from 'cashscript';
import { QRCodeSVG } from 'qrcode.react';
import { ConstructorForm } from '../components/ConstructorForm';
import { ContractSafetyPanel } from '../components/ContractSafetyPanel';
import { pollForFunding, getExplorerLink, FundingStatus } from '../services/blockchainService';
import { Rocket, Server, AlertCircle, CheckCircle, Copy, ShieldAlert, FileCode, Lock, Layout, Repeat, Wand2, Wallet, XCircle, RefreshCw } from 'lucide-react';

interface DeploymentProps {
    project: Project | null;
    walletConnected: boolean;
    onConnectWallet: () => void;
    onUpdateProject: (p: Project) => void;
    onNavigate?: (view: any) => void;
    onDeployed?: (address: string, artifact: ContractArtifact, args: string[]) => void;
    onArtifactsGenerated?: (address: string, artifact: ContractArtifact, args: string[]) => void;
    compact?: boolean;
}

export const Deployment: React.FC<DeploymentProps> = ({ project, walletConnected, onConnectWallet, onUpdateProject, onNavigate, onDeployed, onArtifactsGenerated, compact = false }) => {
    const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.BCH_TESTNET);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentStep, setDeploymentStep] = useState(0);
    const [txHash, setTxHash] = useState<string | null>(null);

    // Artifact State
    const [artifact, setArtifact] = useState<ContractArtifact | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationError, setCompilationError] = useState<string | null>(null);
    const [isFixing, setIsFixing] = useState(false);

    // Modal State
    const [showConstructorModal, setShowConstructorModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const [isDeterminismVerified, setIsDeterminismVerified] = useState(false);
    const [derivedAddress, setDerivedAddress] = useState<string>('');
    const [derivationError, setDerivationError] = useState<string | null>(null);
    const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
    const [constructorValidations, setConstructorValidations] = useState<Record<string, any>>({});
    const [fundingAmount, setFundingAmount] = useState<number>(2000);
    const [paymentRequestUri, setPaymentRequestUri] = useState<string | null>(null);
    const [fundingStatus, setFundingStatus] = useState<FundingStatus>({ status: 'idle', utxos: [], totalValue: 0 });

    // WalletConnect State
    const [wcUri, setWcUri] = useState<string | null>(null);
    const [wcSession, setWcSession] = useState<any | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        // Sync local session state with service
        const session = walletConnectService.getSession();
        if (session) {
            setWcSession(session);
            // Notify parent app of connection state if needed
            if (!walletConnected) onConnectWallet();
        }

        const onConnected = (s: any) => {
            setWcSession(s);
            setWcUri(null);
            setIsConnecting(false);
            if (!walletConnected) onConnectWallet();
        };

        const onDisconnected = () => {
            setWcSession(null);
            setWcUri(null);
            setIsConnecting(false);
            if (walletConnected) onConnectWallet(); // Toggle off
        };

        const onProposal = (uri: string) => {
            setWcUri(uri);
        };

        walletConnectService.on('session_connected', onConnected);
        walletConnectService.on('session_disconnected', onDisconnected);
        walletConnectService.on('session_proposal', onProposal);

        return () => {
            walletConnectService.off('session_connected', onConnected);
            walletConnectService.off('session_disconnected', onDisconnected);
            walletConnectService.off('session_proposal', onProposal);
        };
    }, [walletConnected, onConnectWallet]);

    if (!project) return <div className="p-8 text-center text-gray-500">No project selected.</div>;

    const auditScore = project.auditReport?.score || 0;
    const isAuditPassed = auditScore >= 80;

    const handlePrepare = async () => {
        setIsCompiling(true);
        setCompilationError(null);
        setArtifact(null);
        setIsDeterminismVerified(false);

        try {
            await new Promise(r => setTimeout(r, 500));
            const result = compileCashScript(project.contractCode);

            if (!result.success || !result.artifact) {
                setCompilationError(result.errors.join('\n'));
                setIsCompiling(false);
                return;
            }

            const isDeterministic = await verifyDeterminism(project.contractCode, result.artifact.bytecode);

            if (!isDeterministic) {
                setCompilationError("CRITICAL: Determinism check failed. Bytecode output is not reproducible.");
                setIsCompiling(false);
                return;
            }

            setArtifact(result.artifact);
            setIsDeterminismVerified(true);
            setShowConstructorModal(true); // Open modal on success

        } catch (e: any) {
            setCompilationError(e.message);
        } finally {
            setIsCompiling(false);
        }
    };

    const handleAutoFix = async () => {
        if (!compilationError) return;
        setIsFixing(true);
        try {
            const prompt = `Fix the following CashScript compiler error in the contract.\nError: ${compilationError} `;
            const result = await fixSmartContract(project.contractCode, prompt);

            onUpdateProject({
                ...project,
                contractCode: result.code,
                lastModified: Date.now()
            });

            setCompilationError(null);
            handlePrepare(); // Auto-recompile
        } catch (e) {
            console.error("Auto-Fix failed", e);
        } finally {
            setIsFixing(false);
        }
    };

    const handleConnectWC = async () => {
        setIsConnecting(true);
        try {
            const chainId = 'bch:testnet';
            await walletConnectService.connect(chainId);
        } catch (e) {
            console.error(e);
            setIsConnecting(false);
        }
    };

    const handleDisconnectWC = async () => {
        await walletConnectService.disconnect();
    };

    const handleDeploy = async () => {
        if (!isAuditPassed) {
            alert(`Security Audit Gate: Score must be 80+ to deploy. Current: ${auditScore}`);
            return;
        }

        if (!derivedAddress) {
            alert("Address derivation failed. check inputs.");
            return;
        }

        setIsDeploying(true);
        setDeploymentStep(1); // Prepared

        try {
            // Construct Payment Request URI (BIP-21)
            const amountBch = fundingAmount / 100_000_000;
            const uri = `${derivedAddress}?amount=${amountBch}&label=NexOps%20Deployment`;

            setPaymentRequestUri(uri);
            setDeploymentStep(2); // Waiting for Payment
            setFundingStatus({ status: 'monitoring', utxos: [], totalValue: 0 });

            console.log("Payment URI:", uri);
            console.log("Starting blockchain monitoring for:", derivedAddress);

            // Start real-time UTXO monitoring
            pollForFunding(
                derivedAddress,
                fundingAmount,
                (status) => {
                    console.log('[Deployment] Funding status update:', status);
                    setFundingStatus(status);

                    if (status.status === 'confirmed') {
                        // Success Callback
                        if (onDeployed && artifact) {
                            onDeployed(derivedAddress, artifact, constructorArgs);
                        }

                        // Delay transition to show "Funded" state
                        if (onNavigate) {
                            setTimeout(() => {
                                setDeploymentStep(4); // Success
                                setTxHash(status.txid || 'Unknown');
                                onNavigate('AUDITOR');
                            }, 2000);
                        } else {
                            // Fallback if no navigation (e.g. standalone)
                            setDeploymentStep(4);
                            setTxHash(status.txid || 'Unknown');
                        }
                    }
                },
                300000 // 5 minute timeout
            ).catch((error) => {
                console.error('[Deployment] Funding monitoring error:', error);
                setFundingStatus({
                    status: 'error',
                    utxos: [],
                    totalValue: 0,
                    error: error.error || 'Monitoring failed'
                });
            });

        } catch (e) {
            console.error("Deployment failed", e);
            setDeploymentStep(0);
            setFundingStatus({ status: 'error', utxos: [], totalValue: 0, error: (e as Error).message });
        } finally {
            setIsDeploying(false);
        }
    };

    // Check if all critical validations pass
    const hasCriticalValidationErrors = () => {
        return Object.values(constructorValidations).some(
            (validation: any) => validation?.severity === 'error'
        );
    };

    // Address Derivation Effect
    useEffect(() => {
        if (!artifact) return;

        setDerivationError(null);

        try {
            if (constructorArgs.length === artifact.constructorInputs.length) {
                const addr = deriveContractAddress(artifact, constructorArgs, Network.TESTNET3);
                setDerivedAddress(addr);
                // setShowSuccessModal(true); // removed to avoid auto-popup on every keystroke, user clicks confirm in modal
            } else {
                setDerivedAddress('');
            }
        } catch (e: any) {
            console.error("❌ [Deployment] Derivation failed:", e);
            setDerivationError(e.message || "Invalid arguments");
            setDerivedAddress('');
        }
    }, [artifact, constructorArgs]);

    const formatAddressPreview = (sh: string) => `bchtest:p${sh.substring(0, 36)}...`;
    // Safer wallet address extraction
    const walletAddress = wcSession?.namespaces?.bch?.accounts?.[0]?.split(':')[2] || 'Connected';

    return (
        <div className={compact ? "flex flex-col gap-3 p-2 h-full overflow-y-auto custom-scrollbar" : "flex flex-col gap-6 pb-20"}>

            {/* CONSTRUCTOR MODAL */}
            <Modal
                isOpen={showConstructorModal}
                onClose={() => setShowConstructorModal(false)}
                title="Configure Contract Parameters"
            >
                <div className="space-y-4">
                    <p className="text-gray-400 text-sm">
                        Enter the constructor arguments to derive the deterministic address for your contract.
                    </p>
                    {artifact && (
                        <ConstructorForm
                            inputs={artifact.constructorInputs}
                            values={constructorArgs}
                            onChange={(args, validations) => {
                                setConstructorArgs(args);
                                setConstructorValidations(validations);
                            }}
                        />
                    )}

                    {/* Safety Panel in Modal */}
                    <div className="pt-2 border-t border-nexus-800">
                        <ContractSafetyPanel
                            artifact={artifact}
                            validations={constructorValidations}
                            derivedAddress={derivedAddress}
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button
                            onClick={() => {
                                setShowConstructorModal(false);
                                if (derivedAddress && artifact) {
                                    if (onArtifactsGenerated) {
                                        onArtifactsGenerated(derivedAddress, artifact, constructorArgs);
                                    }
                                    setShowSuccessModal(true);
                                }
                            }}
                            disabled={!derivedAddress || hasCriticalValidationErrors()}
                        >
                            Confirm & View Address
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* SUCCESS MODAL */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Artifacts Generated Successfully"
            >
                <div className="space-y-4 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center border border-green-500/50 mb-2">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h4 className="text-xl font-bold text-white">Contract Optimized</h4>
                    <p className="text-gray-400 text-sm">
                        Your contract has been compiled and is ready for funding on Testnet.
                    </p>

                    <div className="bg-nexus-900 p-3 rounded border border-nexus-700 text-left">
                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Derived Address</label>
                        <div className="flex justify-between items-center bg-black/50 p-2 rounded">
                            <span className="font-mono text-nexus-cyan text-xs truncate mr-2">{derivedAddress}</span>
                            <Copy className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" />
                        </div>
                    </div>

                    <div className="flex space-x-3 pt-2">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => window.open(getExplorerLink(derivedAddress), '_blank')}
                            icon={<Server className="w-4 h-4" />}
                        >
                            View on Explorer
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => setShowSuccessModal(false)}
                        >
                            Continue to Funding
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Config & Artifacts */}
            <div className={compact ? "space-y-3" : "space-y-6"}>
                <Card>
                    <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                        <Server className="w-5 h-5 mr-2 text-nexus-purple" />
                        Network & Compiler
                    </h3>
                    <div className={compact ? "space-y-3 mb-3" : "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"}>
                        <div>
                            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Target Network</label>
                            <div className="bg-nexus-900 border border-nexus-700 text-gray-300 rounded px-3 py-2 text-sm">
                                Bitcoin Cash (Testnet)
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
                        <div className="text-center py-8 bg-nexus-900/30 rounded border border-dashed border-nexus-700 transition-all">
                            {compilationError ? (
                                <div className="space-y-4">
                                    <div className="mx-auto w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center border border-red-500/30">
                                        <AlertCircle className="w-6 h-6 text-red-500" />
                                    </div>
                                    <h4 className="text-red-400 font-bold">Compilation Failed</h4>
                                    <div className="p-3 bg-red-900/20 text-red-300 text-xs border border-red-800 rounded text-left font-mono whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar">
                                        {compilationError}
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-center gap-3">
                                        <Button variant="secondary" onClick={handlePrepare} size="sm">Retry Compilation</Button>
                                        <Button
                                            variant="secondary"
                                            className="border-nexus-cyan text-nexus-cyan hover:bg-nexus-cyan/10"
                                            icon={<Wand2 className="w-4 h-4" />}
                                            onClick={handleAutoFix}
                                            isLoading={isFixing}
                                            size="sm"
                                        >
                                            Auto-Fix Error
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Button onClick={handlePrepare} isLoading={isCompiling} icon={<FileCode className="w-4 h-4" />}>
                                        Prepare Deployment Artifacts
                                    </Button>
                                    <p className="mt-2 text-xs text-gray-500">Compiles code and verifies deterministic bytecode.</p>
                                </>
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

                            {/* Constructor Inputs (In-Panel) */}
                            <div className="bg-nexus-900/50 p-3 rounded border border-nexus-700/50 mb-4">
                                <label className="text-xs text-gray-400 uppercase font-bold mb-3 block flex items-center">
                                    <FileCode className="w-3 h-3 mr-1" /> Constructor Arguments
                                </label>
                                <ConstructorForm
                                    inputs={artifact.constructorInputs}
                                    values={constructorArgs}
                                    onChange={(args, validations) => {
                                        setConstructorArgs(args);
                                        setConstructorValidations(validations);
                                    }}
                                />
                            </div>

                            {/* Artifact Preview Details */}
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center">
                                    <Lock className="w-3 h-3 mr-1" /> Locking Address (Derived)
                                </label>
                                <div className="font-mono text-xs bg-nexus-900 p-2 rounded text-nexus-cyan truncate border border-nexus-700">
                                    {derivedAddress || (artifact.scriptHash ? formatAddressPreview(artifact.scriptHash) : "Thinking...")}
                                </div>
                                <div className="mt-1 flex items-center text-[10px] text-yellow-500 font-bold bg-yellow-900/10 p-1 rounded">
                                    <AlertCircle className="w-3 h-3 mr-1" /> WARNING: Contract is NOT live until funded.
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold mb-1 flex items-center">
                                    <FileCode className="w-3 h-3 mr-1" /> Locking Bytecode
                                </label>
                                <div className="font-mono text-[10px] bg-black p-2 rounded text-gray-500 break-all border border-nexus-800 max-h-24 overflow-y-auto custom-scrollbar">
                                    {artifact.bytecode}
                                </div>
                            </div>



                            {/* Contract Safety Panel */}
                            <ContractSafetyPanel
                                artifact={artifact}
                                validations={constructorValidations}
                                derivedAddress={derivedAddress}
                            />

                            <Button size="sm" variant="secondary" onClick={handlePrepare} className="w-full" icon={<Repeat className="w-3 h-3" />}>
                                Re-Compile & Configure
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

            {/* Actions */}
            <div className="space-y-6">
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

                        {/* Top Notification: Deployment Blocked (Only if connected or critical) */}
                        {(!isAuditPassed && wcSession) && (
                            <div className="p-4 bg-red-900/10 border border-red-900/50 rounded text-center">
                                <ShieldAlert className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                <h4 className="text-red-400 font-bold mb-1">Deployment Blocked</h4>
                                <p className="text-xs text-red-300">
                                    Security score is below 80/100. <br />
                                    Return to Auditor to fix vulnerabilities.
                                </p>
                            </div>
                        )}

                        {!wcSession ? (
                            // Not Connected State - Shows connect button regardless of audit for UX
                            <div className="text-center p-6 bg-nexus-900/50 border border-nexus-700 rounded transition-all">
                                {!wcUri ? (
                                    // Initial State
                                    <>
                                        <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                                        <p className="text-sm text-gray-300 mb-4">Connect Mobile Wallet (Testnet)</p>
                                        <Button
                                            onClick={handleConnectWC}
                                            className="w-full bg-nexus-blue hover:bg-nexus-blue/80"
                                            isLoading={isConnecting}
                                        >
                                            Generate QRCode
                                        </Button>
                                        <div className="flex justify-center space-x-4 mt-4 opacity-50 grayscale">
                                            <span className="text-[10px] text-gray-400">Paytaca</span>
                                            <span className="text-[10px] text-gray-400">Electron Cash</span>
                                        </div>
                                    </>
                                ) : (
                                    // QR Code State
                                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                        <div className="bg-white p-3 rounded-xl mb-4">
                                            <QRCodeSVG value={wcUri} size={180} />
                                        </div>
                                        <p className="text-xs text-gray-400 mb-4 animate-pulse">Scan with Paytaca or OPTN Wallet</p>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => { setWcUri(null); setIsConnecting(false); }}
                                            icon={<RefreshCw className="w-3 h-3" />}
                                        >
                                            Reset
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Connected State
                            <div className="space-y-3">
                                <div className="p-4 bg-nexus-cyan/10 border border-nexus-cyan/30 rounded-xl flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center space-x-3">
                                        {wcSession?.peer?.metadata?.icons?.[0] ? (
                                            <img src={wcSession.peer.metadata.icons[0]} alt="Wallet" className="w-10 h-10 rounded-full border border-nexus-cyan/30" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-nexus-cyan/20 flex items-center justify-center">
                                                <Wallet className="w-5 h-5 text-nexus-cyan" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs text-nexus-cyan font-bold uppercase tracking-widest mb-0.5">Connected</p>
                                            <h4 className="text-white font-medium text-sm">
                                                {wcSession?.peer?.metadata?.name || "Unknown Wallet"}
                                            </h4>
                                            <div className="flex items-center mt-1 space-x-2">
                                                <Badge variant="neutral" className="text-[10px] py-0 px-1.5 h-4">
                                                    Testnet
                                                </Badge>
                                                <span className="text-[10px] text-gray-400 font-mono truncate max-w-[100px]">
                                                    {walletAddress}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="glass"
                                        size="sm"
                                        onClick={handleDisconnectWC}
                                        className="h-8 w-8 p-0 border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-full"
                                    >
                                        <XCircle className="w-4 h-4" />
                                    </Button>
                                </div>

                                {!artifact ? (
                                    <div className="text-center p-4 bg-nexus-900/50 border border-nexus-700 rounded">
                                        <FileCode className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm text-gray-300">Artifacts not ready.</p>
                                    </div>
                                ) : (
                                    <>

                                        <div className="mb-4">
                                            <label className="text-xs text-gray-400 uppercase font-bold mb-1 block">Initial Funding (Sats)</label>
                                            <input
                                                type="number"
                                                value={fundingAmount}
                                                onChange={(e) => setFundingAmount(Number(e.target.value))}
                                                className="w-full bg-nexus-900 border border-nexus-700 rounded p-2 text-sm text-white font-mono"
                                            />
                                        </div>

                                        {deploymentStep === 2 && paymentRequestUri ? (
                                            <div className="bg-white p-4 rounded-xl flex flex-col items-center animate-in zoom-in duration-300">
                                                <QRCodeSVG value={paymentRequestUri} size={180} />
                                                <p className="text-black text-xs font-bold mt-2 text-center break-all max-w-[200px]">
                                                    {derivedAddress}
                                                </p>
                                                <p className="text-gray-500 text-[10px] mt-1">Scan to Fund Contract ({fundingAmount} sats)</p>

                                                {/* Real-time Funding Status */}
                                                <div className="mt-4 w-full">

                                                    {/* TEMP BYPASS: Checking if we are monitoring, show 'Funded' to allow interaction test */}
                                                    {fundingStatus.status === 'monitoring' && (
                                                        <div className="flex items-center justify-center text-blue-600 text-xs">
                                                            <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                                                            Monitoring blockchain... ({fundingStatus.totalValue} / {fundingAmount} sats)
                                                        </div>
                                                    )}
                                                    {fundingStatus.status === 'confirmed' && (
                                                        <div className="flex flex-col items-center text-green-600 text-xs">
                                                            <div className="flex items-center mb-2">
                                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                                Funded! ✓
                                                            </div>
                                                            {fundingStatus.txid && (
                                                                <a
                                                                    href={getExplorerLink(fundingStatus.txid)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:underline text-[10px] font-mono truncate max-w-[180px]"
                                                                >
                                                                    {fundingStatus.txid}
                                                                </a>
                                                            )}
                                                            <Button
                                                                size="sm"
                                                                className="mt-2"
                                                                onClick={() => {
                                                                    if (onDeployed && artifact) {
                                                                        onDeployed(derivedAddress!, artifact, constructorArgs);
                                                                    }
                                                                }}
                                                            >
                                                                Proceed to Interact
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {fundingStatus.status === 'timeout' && (
                                                        <div className="flex items-center justify-center text-yellow-600 text-xs">
                                                            <AlertCircle className="w-3 h-3 mr-2" />
                                                            Timeout - Please verify manually
                                                        </div>
                                                    )}
                                                    {fundingStatus.status === 'error' && (
                                                        <div className="flex items-center justify-center text-red-600 text-xs">
                                                            <AlertCircle className="w-3 h-3 mr-2" />
                                                            {fundingStatus.error || 'Monitoring error'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <Button
                                                onClick={handleDeploy}
                                                disabled={isDeploying || deploymentStep === 4 || !derivedAddress || hasCriticalValidationErrors() || !isAuditPassed}
                                                isLoading={isDeploying}
                                                className="w-full bg-nexus-cyan hover:bg-cyan-400 text-black font-bold h-12 text-sm uppercase tracking-widest shadow-lg shadow-nexus-cyan/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                icon={<Rocket className="w-4 h-4" />}
                                            >
                                                {deploymentStep === 4
                                                    ? "Broadcasted"
                                                    : !isAuditPassed
                                                        ? "Security Audit Required"
                                                        : hasCriticalValidationErrors()
                                                            ? "Funding Blocked (Invalid Inputs)"
                                                            : "Generate Funding Request"}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Console */}
                <Card className="font-mono text-sm bg-black border-nexus-700 min-h-[200px] flex flex-col">
                    <div className="border-b border-nexus-800 pb-2 mb-2 text-gray-500 uppercase text-xs">Deployment Log</div>
                    <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                        <p className="text-gray-500">Waiting for command...</p>
                        {isCompiling && <p className="text-nexus-cyan">&gt; Compiling contract...</p>}
                        {isFixing && <p className="text-nexus-purple animate-pulse">&gt; Analyzing compiler error with NexusAI...</p>}
                        {artifact && <p className="text-green-500">&gt; Artifacts generated. Bytecode size: {artifact.bytecode.length / 2} bytes.</p>}

                        {deploymentStep >= 1 && <p className="text-nexus-cyan">&gt; Initiating deployment...</p>}
                        {deploymentStep >= 2 && <p className="text-yellow-500 animate-pulse">&gt; Requesting signature on mobile device...</p>}
                        {deploymentStep >= 3 && <p className="text-nexus-cyan">&gt; Broadcasting signed transaction...</p>}

                        {deploymentStep >= 4 && (
                            <div className="mt-4 p-4 border border-green-900/50 bg-green-900/10 rounded">
                                <p className="text-green-400 flex items-center font-bold mb-2"><CheckCircle className="w-4 h-4 mr-2" /> Contract Deployed!</p>
                                <p className="text-gray-400">Transaction Hash:</p>
                                <div className="flex items-center space-x-2 mt-1">
                                    <span className="text-white bg-nexus-800 px-2 py-1 rounded text-xs">{txHash}</span>
                                    <Copy className="w-4 h-4 text-gray-400 cursor-pointer hover:text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};