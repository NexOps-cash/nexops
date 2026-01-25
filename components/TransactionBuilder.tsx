import React, { useState, useEffect } from 'react';
import { ContractArtifact } from '../services/compilerService';
import { Button, Badge, Modal, Input, Card } from './UI';
import {
    Play, Terminal, Activity, CheckCircle,
    ArrowRight, Wallet, ChevronRight, AlertCircle,
    Cpu, Hash, ArrowLeft, Loader2
} from 'lucide-react';
import { getExplorerLink } from '../services/blockchainService';

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

    const handleExecute = async () => {
        if (!selectedFunction || !wcSession) return;

        setIsExecuting(true);
        try {
            // Validate inputs
            const func = functions.find(f => f.name === selectedFunction);
            if (!func) throw new Error("Function not found");

            // Type conversion simulation
            const typedArgs = inputs.map((input, i) => {
                const def = func.inputs[i];
                if (def.type === 'int') {
                    if (isNaN(Number(input.value))) throw new Error(`Invalid integer for ${input.name}`);
                    return BigInt(input.value);
                }
                if (def.type === 'bool') return input.value === 'true';
                return input.value;
            });

            console.log("Executing with:", typedArgs);

            // Simulating network delay and signature
            await new Promise(r => setTimeout(r, 2000));

            // Mock Success (Replace with actual CashScript call later)
            setExecutionResult({
                success: true,
                txid: '7f9c8d...3a2b1' // Mock TXID
            });

        } catch (error: any) {
            setExecutionResult({
                success: false,
                error: error.message
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
        return wcSession?.namespaces?.bch?.accounts?.[0]?.split(':')[2] || 'Not Connected';
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
                            <Input
                                value={input.value}
                                onChange={(e) => handleInputChange(idx, e.target.value)}
                                placeholder={`Enter ${input.type} value`}
                                className="font-mono text-sm"
                            />
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

    const renderStep3_Preview = () => (
        <div className="space-y-6">
            <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                        <Wallet className="w-3 h-3 mr-2 text-nexus-pink" /> Transaction Signer
                    </h4>
                </div>
                <div className="p-4 flex items-center justify-between">
                    <span className="text-sm text-white font-mono break-all">{getWalletAddress()}</span>
                    {!wcSession && <span className="text-xs text-red-500 font-bold">DISCONNECTED</span>}
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
                        setCurrentStep(4); // Move to execution/result view
                    }}
                    disabled={!wcSession}
                    variant={!wcSession ? 'secondary' : 'primary'}
                    icon={<Play className="w-4 h-4" />}
                >
                    {wcSession ? 'Sign & Broadcast' : 'Connect Wallet First'}
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
