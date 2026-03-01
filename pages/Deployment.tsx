import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Card, Button, Badge, Modal } from '../components/UI';
import { Project, ChainType, BYOKSettings } from '../types';
import { ContractArtifact } from '../types';
import { compileCashScript, verifyDeterminism } from '../services/compilerService';
import { fixSmartContract } from '../services/groqService';
import { walletConnectService, ConnectionStatus } from '../services/walletConnectService';
import { deriveContractAddress } from '../services/addressService';
import { Network } from 'cashscript';
import { QRCodeSVG } from 'qrcode.react';
import { ConstructorForm } from '../components/ConstructorForm';
import { ContractSafetyPanel } from '../components/ContractSafetyPanel';
import { pollForFunding, getExplorerLink, FundingStatus, UTXO, fetchUTXOs } from '../services/blockchainService';
import { useWallet } from '../contexts/WalletContext';
import { DeploymentRecord } from '../types';
import { Rocket, Server, AlertCircle, CheckCircle, Copy, ShieldAlert, FileCode, Lock, Layout, Repeat, Wand2, Wallet, XCircle, RefreshCw, Box, Coins, Clock, ExternalLink, Play, Loader2, Zap, ShieldCheck } from 'lucide-react';

interface DeploymentProps {
    project: Project | null;
    walletConnected: boolean;
    onConnectWallet: () => void;
    onUpdateProject: (p: Project) => void;
    onNavigate?: (view: any) => void;
    onDeployed?: (address: string, artifact: ContractArtifact, args: string[], fundingUtxo?: UTXO) => void;
    onArtifactsGenerated?: (address: string, artifact: ContractArtifact, args: string[]) => void;
    compact?: boolean;
    burnerWif?: string;
    burnerAddress?: string;
    burnerPubkey?: string;
    onGenerateBurner?: () => void;
    isGeneratingBurner?: boolean;
    useExternalGenerator?: boolean;
    byokSettings?: BYOKSettings;
}

export const Deployment: React.FC<DeploymentProps> = ({
    project,
    walletConnected,
    onConnectWallet,
    onUpdateProject,
    onNavigate,
    onDeployed,
    onArtifactsGenerated,
    compact = false,
    burnerWif,
    burnerAddress,
    burnerPubkey,
    onGenerateBurner,
    isGeneratingBurner = false,
    useExternalGenerator = false,
    byokSettings
}) => {
    const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.BCH_TESTNET);
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentStep, setDeploymentStep] = useState(0);
    const [txHash, setTxHash] = useState<string | null>(null);

    const { wallets } = useWallet();

    // Artifact State
    const [artifact, setArtifact] = useState<ContractArtifact | null>(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationError, setCompilationError] = useState<string | null>(null);
    const [isFixing, setIsFixing] = useState(false);

    // Modal State
    const [showConstructorModal, setShowConstructorModal] = useState(false);
    const [fundingUtxo, setFundingUtxo] = useState<UTXO | null>(null);
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
    const [wcSession, setWcSession] = useState<any | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        // If project already has a deployed address, set success state
        if (project?.deployedAddress && !fundingUtxo) {
            setDeploymentStep(4);
            setDerivedAddress(project.deployedAddress);

            // Re-fetch UTXO metadata for exact height/value
            fetchUTXOs(project.deployedAddress).then(utxos => {
                if (utxos.length > 0) {
                    setFundingUtxo(utxos[0]);
                    setTxHash(utxos[0].txid);
                }
            });
        }

        // Sync local session state with service
        const session = walletConnectService.getSession();
        if (session) {
            setWcSession(session);
            // Notify parent app of connection state if needed
            if (!walletConnected) onConnectWallet();
        }

        const onConnected = (s: any) => {
            setWcSession(s);
            setIsConnecting(false);
            if (!walletConnected) onConnectWallet();
        };

        const onDisconnected = () => {
            setWcSession(null);
            setIsConnecting(false);
            if (walletConnected) onConnectWallet(); // Toggle off
        };

        walletConnectService.on('session_connected', onConnected);
        walletConnectService.on('session_disconnected', onDisconnected);

        return () => {
            walletConnectService.off('session_connected', onConnected);
            walletConnectService.off('session_disconnected', onDisconnected);
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
            const result = await fixSmartContract(project.contractCode, prompt, useExternalGenerator, null, byokSettings);

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
            toast.error(`Security Audit Gate: Score must be 80+ to deploy. Current: ${auditScore}`);
            return;
        }

        if (!derivedAddress) {
            toast.error("Address derivation failed. check inputs.");
            return;
        }

        setIsDeploying(true);
        setDeploymentStep(1); // Prepared

        try {
            // 0. Identity Guard: Detect Owner and Funder wallets
            const ownerInput = artifact?.constructorInputs.find(i => i.name.toLowerCase().includes('owner'));
            const funderInput = artifact?.constructorInputs.find(i => i.name.toLowerCase().includes('funder'));

            let ownerWalletId = '';
            let funderWalletId = '';

            if (ownerInput) {
                const ownerVal = constructorArgs[artifact!.constructorInputs.indexOf(ownerInput)];
                const w = wallets.find(wall => wall.pubkey === ownerVal || wall.address === ownerVal);
                if (w) ownerWalletId = w.id;
            }

            if (funderInput) {
                const funderVal = constructorArgs[artifact!.constructorInputs.indexOf(funderInput)];
                const w = wallets.find(wall => wall.pubkey === funderVal || wall.address === funderVal);
                if (w) funderWalletId = w.id;
            }

            if (ownerWalletId && funderWalletId && ownerWalletId === funderWalletId) {
                if (!confirm("IDENTITY GUARD WARNING: You are using the SAME wallet for both Owner and Funder. This is often an anti-pattern in smart contracts (Self-Funding). Proceed anyway?")) {
                    setIsDeploying(false);
                    return;
                }
            }

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
                        setDeploymentStep(4); // Success
                        setTxHash(status.txid || 'Unknown');

                        const utxo = status.utxos.find(u => u.txid === status.txid) || status.utxos[0];
                        setFundingUtxo(utxo);

                        // Update Project with Deployment Record
                        const record: DeploymentRecord = {
                            contractAddress: derivedAddress!,
                            ownerWalletId,
                            funderWalletId,
                            constructorArgs: [...constructorArgs], // Deep copy to ensure persistence
                            timestamp: Date.now()
                        };

                        onUpdateProject({
                            ...project,
                            deployedAddress: derivedAddress!,
                            deployedArtifact: artifact!,
                            constructorArgs,
                            deploymentRecord: record,
                            lastModified: Date.now()
                        });

                        if (onDeployed && artifact) {
                            onDeployed(derivedAddress!, artifact, constructorArgs, utxo);
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
                            burnerWif={burnerWif}
                            burnerAddress={burnerAddress}
                            burnerPubkey={burnerPubkey}
                            onGenerateBurner={onGenerateBurner}
                            isGeneratingBurner={isGeneratingBurner}
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
                {deploymentStep === 4 && (
                    <Card className="border-green-500/30 bg-green-500/5 animate-in slide-in-from-top-4 duration-500 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-2 opacity-10">
                            <Rocket className="w-12 h-12 text-green-500" />
                        </div>
                        <p className="text-green-400 flex items-center font-black mb-3 uppercase tracking-widest text-xs">
                            <CheckCircle className="w-4 h-4 mr-2" /> Contract Live on Chipnet
                        </p>

                        {(fundingUtxo || project?.deployedAddress) && (
                            <div className="mb-4 space-y-2 bg-black/40 p-3 rounded-lg border border-white/5 backdrop-blur-sm">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500 uppercase font-bold flex items-center"><Box className="w-3 h-3 mr-1" /> Block Height</span>
                                    <span className="text-nexus-cyan font-mono">{fundingUtxo?.height || 'Pending...'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500 uppercase font-bold flex items-center"><Coins className="w-3 h-3 mr-1" /> Funding Amount</span>
                                    <span className="text-nexus-cyan font-mono">{fundingUtxo?.value ? `${fundingUtxo.value.toLocaleString()} sats` : 'Calculating...'}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-gray-500 uppercase font-bold flex items-center"><Clock className="w-3 h-3 mr-1" /> Status</span>
                                    <span className="text-nexus-cyan font-mono uppercase text-[9px] font-black">Active / Published</span>
                                </div>
                            </div>
                        )}

                        <p className="text-gray-400 text-[10px] uppercase font-bold mb-1 ml-1 opacity-60">Contract Address</p>
                        <div className="flex items-center space-x-2 mb-4">
                            <span className="text-nexus-cyan bg-nexus-900 border border-nexus-700 px-3 py-2 rounded font-mono text-xs flex-1 truncate">{derivedAddress || project?.deployedAddress}</span>
                            <Button
                                variant="glass"
                                className="h-9 w-9 p-0 flex-shrink-0"
                                onClick={() => {
                                    navigator.clipboard.writeText(derivedAddress || project?.deployedAddress || '');
                                    toast.success("Address Copied!");
                                }}
                            >
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="primary"
                                className="flex-1 text-[10px] font-bold uppercase shadow-[0_0_15px_rgba(0,229,255,0.2)]"
                                onClick={() => onNavigate?.('INTERACT')}
                                icon={<Play className="w-3 h-3" />}
                            >
                                Interact
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 text-[10px] font-bold uppercase"
                                onClick={() => window.open(getExplorerLink(txHash || project?.deployedAddress || ''), '_blank')}
                                icon={<ExternalLink className="w-3 h-3" />}
                            >
                                Explorer
                            </Button>
                        </div>
                        <Button
                            variant="glass"
                            className="w-full mt-2 text-[10px] border-nexus-cyan/20 opacity-40 hover:opacity-100"
                            onClick={() => {
                                setDeploymentStep(0);
                                setFundingUtxo(null);
                                setTxHash(null);
                            }}
                        >
                            Redeploy
                        </Button>
                    </Card>
                )}

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
                                        <Button variant="secondary" onClick={handlePrepare}>Retry Compilation</Button>
                                        <Button
                                            variant="secondary"
                                            className="border-nexus-cyan text-nexus-cyan hover:bg-nexus-cyan/10"
                                            icon={<Wand2 className="w-4 h-4" />}
                                            onClick={handleAutoFix}
                                            isLoading={isFixing}
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
                                    burnerWif={burnerWif}
                                    burnerAddress={burnerAddress}
                                    burnerPubkey={burnerPubkey}
                                    onGenerateBurner={onGenerateBurner}
                                    isGeneratingBurner={isGeneratingBurner}
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

                            <Button variant="secondary" onClick={handlePrepare} className="w-full" icon={<Repeat className="w-3 h-3" />}>
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
                            <div className="p-8 glass-panel rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl">
                                <div className="flex flex-col items-center justify-center space-y-6">
                                    <div className="w-20 h-20 bg-nexus-cyan/10 rounded-full flex items-center justify-center border border-nexus-cyan/20">
                                        <Wallet className="w-10 h-10 text-nexus-cyan" />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Connection Required</h3>
                                        <p className="text-slate-400 text-sm max-w-[280px]">
                                            Connect a compatible Bitcoin Cash wallet to deploy this contract.
                                        </p>
                                    </div>
                                    <Button
                                        variant="primary"
                                        className="w-full py-4 uppercase font-black tracking-widest text-sm shadow-[0_0_30px_rgba(0,229,255,0.3)]"
                                        onClick={handleConnectWC}
                                        icon={isConnecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                                        disabled={isConnecting}
                                    >
                                        {isConnecting ? 'Opening Modal...' : 'WalletConnect (Beta)'}
                                    </Button>
                                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2">
                                        <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-nexus-cyan" /> Paytaca</span>
                                        <span className="flex items-center"><CheckCircle className="w-3 h-3 mr-1 text-nexus-cyan" /> Zapit</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Connected Wallet Bar */}
                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex justify-between items-center backdrop-blur-md">
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
                                                <Badge variant="info" className="text-[10px] py-0 px-1.5 h-4">Chipnet</Badge>
                                                <span className="text-[10px] text-gray-400 font-mono truncate max-w-[100px]">
                                                    {walletAddress}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="glass" onClick={handleDisconnectWC} className="h-8 w-8 p-0 border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-full">
                                        <XCircle className="w-4 h-4" />
                                    </Button>
                                </div>

                                {!artifact ? (
                                    <div className="text-center p-8 bg-nexus-900/50 border border-dashed border-nexus-700 rounded-xl">
                                        <FileCode className="w-8 h-8 text-gray-400 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm text-gray-500 uppercase font-black tracking-widest">Artifacts Not Compiled</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Deployment Phase Check */}
                                        {deploymentStep === 2 && paymentRequestUri ? (
                                            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl flex flex-col items-center animate-in zoom-in duration-500 backdrop-blur-xl">
                                                <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-nexus-cyan/20 mb-6">
                                                    <QRCodeSVG value={paymentRequestUri} size={180} />
                                                </div>
                                                <div className="text-center space-y-1 mb-6">
                                                    <p className="text-white font-black text-sm uppercase tracking-tighter">Funding Required</p>
                                                    <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest leading-relaxed">Send {fundingAmount.toLocaleString()} sats to address below</p>
                                                </div>
                                                <div className="w-full bg-black/40 p-4 rounded-xl border border-white/5 mb-6 group cursor-pointer" onClick={() => {
                                                    navigator.clipboard.writeText(derivedAddress!);
                                                    toast.success("Address copied!");
                                                }}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Contract Address</span>
                                                        <Copy className="w-3 h-3 text-slate-600 group-hover:text-nexus-cyan transition-colors" />
                                                    </div>
                                                    <p className="text-nexus-cyan font-mono text-[10px] break-all leading-relaxed">
                                                        {derivedAddress}
                                                    </p>
                                                </div>

                                                {/* Funding Status */}
                                                <div className="w-full">
                                                    {fundingStatus.status === 'monitoring' && (
                                                        <div className="flex flex-col items-center space-y-3">
                                                            <div className="flex items-center justify-center text-nexus-cyan text-[11px] font-black uppercase tracking-widest">
                                                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                                                Monitoring Indexer...
                                                            </div>
                                                            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                                                <div
                                                                    className="bg-nexus-cyan h-full transition-all duration-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                                                                    style={{ width: `${Math.min((fundingStatus.totalValue / fundingAmount) * 100, 100)}%` }}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 font-bold">{fundingStatus.totalValue.toLocaleString()} / {fundingAmount.toLocaleString()} sats detected</p>
                                                        </div>
                                                    )}
                                                    {fundingStatus.status === 'confirmed' && (
                                                        <div className="flex flex-col items-center space-y-4">
                                                            <div className="flex items-center text-green-600 font-black uppercase tracking-widest text-sm">
                                                                <CheckCircle className="w-5 h-5 mr-2" />
                                                                Contract Live!
                                                            </div>
                                                            <Button onClick={() => onDeployed?.(derivedAddress!, artifact, constructorArgs, fundingUtxo!)} className="w-full py-4 bg-nexus-blue hover:bg-blue-600 shadow-[0_4px_15px_rgba(37,99,235,0.3)] font-black uppercase tracking-widest text-xs">
                                                                Enter Transaction Builder
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {fundingStatus.status === 'error' && (
                                                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[10px] font-bold text-center">
                                                            {fundingStatus.error || 'Connection Timeout'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="bg-nexus-900 border border-nexus-700/50 p-4 rounded-xl">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Initial Balance</label>
                                                        <span className="text-xs font-mono text-white">{fundingAmount.toLocaleString()} Sats</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="1000"
                                                        max="100000"
                                                        step="1000"
                                                        value={fundingAmount}
                                                        onChange={(e) => setFundingAmount(Number(e.target.value))}
                                                        className="w-full accent-nexus-cyan h-1.5 bg-nexus-800 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                </div>

                                                <Button
                                                    onClick={handleDeploy}
                                                    disabled={isDeploying || !isAuditPassed || hasCriticalValidationErrors()}
                                                    isLoading={isDeploying}
                                                    className="w-full py-5 bg-nexus-cyan hover:bg-cyan-400 text-slate-950 font-black uppercase tracking-[0.2em] text-xs shadow-[0_0_30px_rgba(34,211,238,0.3)] disabled:opacity-20 translate-y-0 active:translate-y-0.5 transition-all"
                                                    icon={<Rocket className="w-5 h-5" />}
                                                >
                                                    {!isAuditPassed ? "Audit Failed" : "Launch Contract"}
                                                </Button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Log Console */}
                <Card className="p-0 border-nexus-700 bg-black overflow-hidden flex flex-col min-h-[180px]">
                    <div className="px-4 py-2 border-b border-nexus-900 bg-nexus-950 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Deployment Trace</span>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500/20" />
                            <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
                            <div className="w-2 h-2 rounded-full bg-green-500/20" />
                        </div>
                    </div>
                    <div className="p-4 font-mono text-[11px] space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
                        <p className="text-slate-600 font-bold">&gt; nexus_os initialized.</p>
                        {isCompiling && <p className="text-nexus-cyan animate-pulse">&gt; running cashc compiler...</p>}
                        {isFixing && <p className="text-nexus-pink animate-pulse">&gt; ai_remediation_agent active: patching source...</p>}
                        {artifact && <p className="text-green-500/80">&gt; bytecode generated: {artifact.bytecode.length / 2} bytes.</p>}
                        {deploymentStep >= 1 && <p className="text-nexus-cyan">&gt; initializing secure deployment channel...</p>}
                        {deploymentStep >= 2 && <p className="text-yellow-500">&gt; awaiting network confirmation...</p>}
                        {deploymentStep >= 4 && <p className="text-green-400 font-bold">&gt; success: contract deployed to block {fundingUtxo?.height || 'latest'}</p>}
                    </div>
                </Card>
            </div>
        </div>
    );
};
