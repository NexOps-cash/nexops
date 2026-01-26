import React, { useState, useEffect } from 'react';
import { ContractArtifact } from '../services/compilerService';
import { Button, Badge, Modal, Input, Card } from './UI';
import {
    Play, Terminal, Activity, CheckCircle,
    ArrowRight, Wallet, ChevronRight, AlertCircle,
    Cpu, Hash, ArrowLeft, Loader2
} from 'lucide-react';
import { getExplorerLink } from '../services/blockchainService';
import { walletConnectService } from '../services/walletConnectService';
import { QRCodeSVG } from 'qrcode.react';

interface TransactionBuilderProps {
    artifact: ContractArtifact;
    deployedAddress: string;
    constructorArgs: string[];
    wcSession: any;
}

interface FunctionInput {
    name: string;
    type: string;
    value: string;
}

export const TransactionBuilder: React.FC<TransactionBuilderProps> = ({
    artifact,
    deployedAddress,
    constructorArgs,
    wcSession
}) => {
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

    // Form State
    const [selectedFunction, setSelectedFunction] = useState<string>('');
    const [inputs, setInputs] = useState<FunctionInput[]>([]);

    // Execution State
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<{ success: boolean; txid?: string; error?: string } | null>(null);

    // Wallet State
    const [connectUri, setConnectUri] = useState<string>('');
    const [activeSession, setActiveSession] = useState<any>(wcSession || walletConnectService.getSession());

    // Parse ABI
    // Note: cashc ABI often omits 'type' for functions, so we include items with no type or type='function'
    const functions = artifact.abi.filter(item => item.type === 'function' || !item.type);

    // Reset state when modal opens
    const openModal = () => {
        setIsModalOpen(true);
        setCurrentStep(1);
        setExecutionResult(null);
        setSelectedFunction('');
        setInputs([]);
    };

    const handleFunctionSelect = (funcName: string) => {
        const func = functions.find(f => f.name === funcName);
        if (!func) return;

        setSelectedFunction(funcName);
        setInputs(func.inputs.map(input => ({
            name: input.name,
            type: input.type,
            value: ''
        })));
        setCurrentStep(2);
    };

    const handleInputChange = (index: number, value: string) => {
        const newInputs = [...inputs];
        newInputs[index].value = value;
        setInputs(newInputs);
    };

    // --- Real Execution Logic ---
    const handleExecute = async () => {
        if (!selectedFunction) return;

        // 1. Setup Provider & Signer
        setIsExecuting(true);
        setExecutionResult(null);

        try {
            // Import dynamically to avoid SSR/Init issues if any
            const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await import('cashscript');

            // Reuse existing connection if possible, or new one
            // Note: ElectrumNetworkProvider manages its own connection to 'chipnet.imaginary.cash' by default for 'chipnet'
            const provider = new ElectrumNetworkProvider('chipnet');

            // 2. Initialize Contract
            // Address is derived from artifact + args. Type assertion used to bypass strict TS check on 'functions'.
            const contract = new Contract(artifact, constructorArgs, { provider }) as any;

            if (deployedAddress && contract.address !== deployedAddress) {
                console.warn("Warning: initialized contract address differs from derived address:", contract.address, deployedAddress);
            }
            console.log('Contract initialized:', contract);
            console.log('Available functions:', contract.functions); // Debugging line

            // 3. Prepare Arguments
            const func = functions.find(f => f.name === selectedFunction);
            if (!func) throw new Error("Function not found");

            // Mock Signature Template for WalletConnect
            // We use the REAL SignatureTemplate class to pass 'instanceof' checks in CashScript.
            // We pass a dummy private key (32 bytes) because we override generateSignature anyway.
            const dummyKey = new Uint8Array(32).fill(1);
            const createWCTemplate = () => {
                const wcTemplate = new SignatureTemplate(dummyKey);
                // Override generateSignature to return empty placeholder
                wcTemplate.generateSignature = (_payload: any, _bchForkId: any) => new Uint8Array(65).fill(0);
                return wcTemplate;
            };

            const typedArgs = await Promise.all(inputs.map(async (input, i) => {
                const def = func.inputs[i];

                // Handle Signature Placeholders
                if (def.type === 'sig') {
                    // Use our placeholder template
                    return createWCTemplate();
                }

                if (def.type === 'int') {
                    if (isNaN(Number(input.value))) throw new Error(`Invalid integer for ${input.name}`);
                    return BigInt(input.value);
                }
                if (def.type === 'bool') return input.value === 'true';
                if (def.type === 'bytes') return input.value.startsWith('0x') ? input.value.slice(2) : input.value;

                return input.value;
            }));

            console.log("Building transaction with args:", typedArgs);

            // 4. Build Transaction Builder
            // Breaking Change Fix: CashScript v0.10+ uses 'unlock' instead of 'functions'
            // to conform to the new mental model (we are unlocking UTXOs).
            // However, the object is still dynamically keyed by function name.

            // 4. Build Transaction (CashScript v0.10+ Flow)
            // In v0.10+, "contract.functions.foo()" is replaced by:
            // 1. Instantiate TransactionBuilder
            // 2. Fetch UTXOs for the contract
            // 3. Add Input using contract.unlock.foo() as the unlocker

            console.log("Fetching contract UTXOs...");
            const utxos = await contract.getUtxos();
            if (utxos.length === 0) {
                throw new Error("No UTXOs found for this contract. Please fund it first.");
            }
            console.log(`Found ${utxos.length} UTXOs for contract.`);

            // Use the first UTXO for simplicity in this generic builder
            // A smarter builder might let user select inputs or use "Coin Control"
            const inputUtxo = utxos[0];

            // Import TransactionBuilder class
            const { TransactionBuilder: CashScriptTransactionBuilder } = await import('cashscript');

            const txBuilder = new CashScriptTransactionBuilder({ provider });

            // Get the unlocker (Redeem Script + Args)
            const unlocker = contract.unlock[selectedFunction](...typedArgs);

            // Add Input
            txBuilder.addInput(inputUtxo, unlocker);

            // 5. Configure Transaction
            const walletAddress = getWalletAddress();
            if (walletAddress && walletAddress !== 'Not Connected') {
                // Ensure chipnet/testnet prefix if missing, though typically handled
                txBuilder.addOutput({ to: walletAddress, amount: 1000n });
            } else {
                txBuilder.addOutput({ to: contract.address, amount: 1000n });
            }

            // 6. Build Unsigned Transaction
            const unsignedHex = await txBuilder.build();
            console.log("Unsigned Hex (Pre-Sign):", unsignedHex);

            // 7. Request Signature from Wallet
            console.log("Requesting signature via WalletConnect...");
            const signedHex = await walletConnectService.requestSignature(unsignedHex, 'bch:chipnet');
            console.log("Signed Hex (Post-Sign):", signedHex);

            // 8. Broadcast
            console.log("Broadcasting...");
            const txid = await provider.sendRawTransaction(signedHex);

            setExecutionResult({
                success: true,
                txid: txid
            });

        } catch (error: any) {
            console.error("Execution failed:", error);
            setExecutionResult({
                success: false,
                error: error.message || "Transaction failed"
            });
        } finally {
            setIsExecuting(false);
        }
    };

    const resetFlow = () => {
        setCurrentStep(1);
        setExecutionResult(null);
        setSelectedFunction('');
    };



    const getWalletAddress = () => {
        return activeSession?.namespaces?.bch?.accounts?.[0]?.split(':')[2] || 'Not Connected';
    };

    // -- Renders --

    const renderStep1_Select = () => (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">Select a function to interact with on the contract.</p>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {functions.map(func => (
                    <button
                        key={func.name}
                        onClick={() => handleFunctionSelect(func.name)}
                        className="flex items-center justify-between w-full p-4 bg-nexus-900 border border-nexus-700/50 hover:border-nexus-cyan/50 hover:bg-nexus-cyan/5 rounded-xl transition-all group text-left"
                    >
                        <div>
                            <span className="font-mono text-nexus-cyan font-bold">{func.name}</span>
                            <span className="ml-2 text-xs text-gray-500">({func.inputs.length} args)</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-nexus-cyan transition-colors" />
                    </button>
                ))}
            </div>
        </div>
    );

    const renderStep2_Args = () => (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-nexus-700 pb-2">
                <span className="text-sm text-gray-400">Function</span>
                <Badge variant="info" className="font-mono">{selectedFunction}</Badge>
            </div>

            <div className="space-y-4">
                {inputs.length === 0 ? (
                    <div className="p-8 bg-nexus-900/30 border border-dashed border-nexus-700 rounded-lg text-center text-gray-500 text-sm">
                        This function requires no arguments.
                    </div>
                ) : (
                    inputs.map((input, idx) => (
                        <div key={idx}>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 ml-1">
                                {input.name} <span className="text-nexus-cyan/80 text-[10px]">({input.type})</span>
                            </label>
                            {input.type === 'sig' ? (
                                <div className="flex items-center p-3 bg-nexus-800/50 border border-nexus-700 rounded-lg text-sm text-gray-400 font-mono italic">
                                    <Wallet className="w-4 h-4 mr-2 text-nexus-pink" />
                                    Will be signed by connected wallet
                                </div>
                            ) : (
                                <Input
                                    value={input.value}
                                    onChange={(e) => handleInputChange(idx, e.target.value)}
                                    placeholder={`Enter ${input.type} value`}
                                    className="font-mono text-sm"
                                />
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep(1)} size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                </Button>
                <Button onClick={() => setCurrentStep(3)} icon={<ArrowRight className="w-4 h-4" />}>
                    Next: Preview
                </Button>
            </div>
        </div>
    );

    // --- Wallet Connection Logic ---
    // (State moved to top)

    const handleConnect = async () => {
        try {
            // Check if already connected (global session check via prop is good, but let's be sure)
            if (walletConnectService.getSession()) {
                console.log("Already connected");
                return;
            }

            const uri = await walletConnectService.connect('bch:chipnet');
            if (uri) {
                setConnectUri(uri);
            }
        } catch (error) {
            console.error("Connection failed:", error);
        }
    };

    // Listen for connection success to close QR
    useEffect(() => {
        const handleSessionConnected = () => {
            setConnectUri('');
            // ideally parent updates 'wcSession' prop, causing re-render
        };
        walletConnectService.on('session_connected', handleSessionConnected);
        return () => {
            walletConnectService.off('session_connected', handleSessionConnected);
        };
    }, []);

    const renderStep3_Preview = () => (
        <div className="space-y-6">
            <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                        <Wallet className="w-3 h-3 mr-2 text-nexus-pink" /> Transaction Signer
                    </h4>
                </div>
                <div className="p-4 flex flex-col items-center justify-between gap-4">
                    {wcSession ? (
                        <div className="text-sm text-white font-mono break-all">{getWalletAddress()}</div>
                    ) : (
                        <div className="w-full text-center">
                            {!connectUri ? (
                                <Button size="sm" onClick={handleConnect} icon={<Wallet className="w-4 h-4" />}>
                                    Connect Wallet
                                </Button>
                            ) : (
                                <div className="flex flex-col items-center animate-in fade-in zoom-in">
                                    <div className="bg-white p-2 rounded-lg mb-2">
                                        <QRCodeSVG value={connectUri} size={150} />
                                    </div>
                                    <p className="text-xs text-gray-400">Scan with Paytaca / Zapit</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                        <Cpu className="w-3 h-3 mr-2 text-nexus-cyan" /> Contract Call
                    </h4>
                </div>
                <div className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Function:</span>
                        <span className="text-nexus-cyan font-mono">{selectedFunction}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Target:</span>
                        <span className="text-gray-300 font-mono truncate max-w-[150px]">{deployedAddress}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep(2)} size="sm">Back</Button>
                <Button
                    onClick={() => {
                        handleExecute();
                        setCurrentStep(4);
                    }}
                    disabled={!activeSession}
                    variant={!activeSession ? 'secondary' : 'primary'}
                    icon={<Play className="w-4 h-4" />}
                >
                    {activeSession ? 'Sign & Broadcast' : 'Wallet Required'}
                </Button>
            </div>
        </div>
    );

    const renderStep4_Result = () => (
        <div className="text-center py-6 space-y-6">
            {isExecuting ? (
                <div className="animate-in fade-in zoom-in">
                    <Loader2 className="w-12 h-12 text-nexus-cyan animate-spin mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white">Broadcasting...</h3>
                    <p className="text-sm text-gray-500">Waiting for wallet signature.</p>
                </div>
            ) : executionResult?.success ? (
                <div className="animate-in fade-in zoom-in space-y-4">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/50">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Transaction Sent!</h3>
                        <p className="text-sm text-gray-400 mt-1">Ref: {executionResult.txid}</p>
                    </div>

                    <div className="flex flex-col gap-2 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => window.open(getExplorerLink(executionResult.txid!), '_blank')}
                        >
                            View on Explorer
                        </Button>
                        <Button onClick={resetFlow}>
                            Make Another Call
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="animate-in fade-in zoom-in space-y-4">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/50">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Transaction Failed</h3>
                        <p className="text-sm text-red-400 mt-2 bg-red-900/20 p-3 rounded border border-red-900/50 font-mono">
                            {executionResult?.error || "Unknown error"}
                        </p>
                    </div>
                    <Button onClick={() => setCurrentStep(2)} variant="secondary">
                        Edit Arguments & Retry
                    </Button>
                </div>
            )}
        </div>
    );

    // -- Main Render --
    return (
        <div className="p-4">
            {/* Primary Trigger */}
            <Card className="bg-nexus-900/50 border-nexus-700 flex flex-col items-center justify-center p-8 space-y-4">
                <Terminal className="w-12 h-12 text-nexus-cyan/50" />
                <div className="text-center">
                    <h3 className="text-lg font-bold text-white">Interact with Contract</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                        Execute functions on the deployed contract. Requires a connected wallet for signing.
                    </p>
                </div>
                <Button onClick={openModal} className="px-8 py-3" icon={<Play className="w-4 h-4" />}>
                    Call Function
                </Button>
            </Card>

            {/* Wizard Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    currentStep === 1 ? "Select Function" :
                        currentStep === 2 ? "Configure Arguments" :
                            currentStep === 3 ? "Review Transaction" :
                                "Execution Status"
                }
            >
                <div className="min-h-[300px]">
                    {currentStep === 1 && renderStep1_Select()}
                    {currentStep === 2 && renderStep2_Args()}
                    {currentStep === 3 && renderStep3_Preview()}
                    {currentStep === 4 && renderStep4_Result()}
                </div>
            </Modal>
        </div>
    );
};
