import React, { useState, useEffect } from 'react';
import { ContractArtifact } from '../services/compilerService';
import { Card, Button, Badge } from './UI';
import { WalletConnectService } from '../services/walletConnectService';
import { Play, Copy, Terminal, Activity, AlertCircle, CheckCircle } from 'lucide-react';
// import { Contract, ElectrumNetworkProvider, Network } from 'cashscript'; // Uncomment when ready

interface TransactionBuilderProps {
    artifact: ContractArtifact;
    deployedAddress: string;
    constructorArgs: string[]; // <--- ADDED: Required for contract reconstruction
    wcSession: any; // WalletConnect Session
}

interface FunctionInput {
    name: string;
    type: string;
    value: string;
}

export const TransactionBuilder: React.FC<TransactionBuilderProps> = ({ artifact, deployedAddress, constructorArgs, wcSession }) => {
    const [selectedFunction, setSelectedFunction] = useState<string>('');
    const [inputs, setInputs] = useState<FunctionInput[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);

    // Parse ABI to get functions
    const functions = artifact.abi.filter(item => item.type === 'function');

    useEffect(() => {
        if (functions.length > 0 && !selectedFunction) {
            handleFunctionSelect(functions[0].name);
        }
    }, [artifact]);

    const handleFunctionSelect = (funcName: string) => {
        const func = functions.find(f => f.name === funcName);
        if (!func) return;

        setSelectedFunction(funcName);
        setInputs(func.inputs.map(input => ({
            name: input.name,
            type: input.type,
            value: ''
        })));

        addLog(`Selected function: ${funcName}`);
    };

    const handleInputChange = (index: number, value: string) => {
        const newInputs = [...inputs];
        newInputs[index].value = value;
        setInputs(newInputs);
    };

    const addLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
    };

    const handleExecute = async () => {
        if (!selectedFunction || !wcSession) return;

        setIsExecuting(true);
        addLog(`Preparing transaction for ${selectedFunction}...`);

        try {
            const func = functions.find(f => f.name === selectedFunction);
            if (!func) throw new Error("Function not found");

            // 1. Validate and convert inputs
            addLog("Validating inputs...");
            const typedArgs = inputs.map((input, i) => {
                const def = func.inputs[i];
                if (def.type === 'int') {
                    if (isNaN(Number(input.value))) throw new Error(`Invalid integer for ${input.name}`);
                    return BigInt(input.value);
                }
                if (def.type === 'bool') return input.value === 'true';
                return input.value;
            });

            addLog(`Inputs valid. Arguments: ${JSON.stringify(typedArgs.map(a => a.toString()))}`);

            // 2. Mock Execution Loop (Placeholder for CashScript)
            // Ideally:
            // const provider = new ElectrumNetworkProvider('chipnet');
            // const contract = new Contract(artifact, constructorArgs, { provider });
            // const tx = await contract.functions[selectedFunction](...typedArgs).send();

            await new Promise(r => setTimeout(r, 1500));
            addLog("⚠️ Execution skipped: CashScript signing provider missing.");
            addLog("Simulation Success: Inputs matched types.");

        } catch (error: any) {
            addLog(`Error: ${error.message}`);
        } finally {
            setIsExecuting(false);
        }
    };

    const getWalletAddress = () => {
        return wcSession?.namespaces?.bch?.accounts?.[0]?.split(':')[2] || 'Unknown';
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Col: Functions */}
                <Card className="col-span-1 border-nexus-700 bg-nexus-900/50">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                        <Activity className="w-4 h-4 mr-2" /> Contract Functions
                    </h3>
                    <div className="space-y-2">
                        {functions.map(func => (
                            <button
                                key={func.name}
                                onClick={() => handleFunctionSelect(func.name)}
                                className={`w-full text-left px-4 py-3 rounded text-sm font-mono transition-colors ${selectedFunction === func.name
                                        ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/50'
                                        : 'bg-black/40 text-gray-400 hover:bg-black/60 border border-transparent'
                                    }`}
                            >
                                {func.name}
                            </button>
                        ))}
                    </div>
                </Card>

                {/* Center Col: Builder Form */}
                <Card className="col-span-1 md:col-span-2 border-nexus-700 bg-nexus-900/50">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center">
                            <Terminal className="w-4 h-4 mr-2 text-nexus-blue" />
                            {selectedFunction || 'Select Function'}
                        </h3>
                        <Badge variant="neutral">{inputs.length} Inputs</Badge>
                    </div>

                    <div className="space-y-4 mb-8">
                        {inputs.map((input, idx) => (
                            <div key={idx}>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    {input.name} <span className="text-nexus-cyan">({input.type})</span>
                                </label>
                                <input
                                    type="text"
                                    value={input.value}
                                    onChange={(e) => handleInputChange(idx, e.target.value)}
                                    placeholder={`${input.type} value...`}
                                    className="w-full bg-black border border-nexus-700 rounded p-2 text-sm font-mono text-white focus:border-nexus-cyan focus:outline-none transition-colors"
                                />
                            </div>
                        ))}
                        {inputs.length === 0 && (
                            <div className="text-center py-8 text-gray-600 italic">
                                No arguments required.
                            </div>
                        )}
                    </div>

                    <div className="border-t border-nexus-800 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <div className="text-xs text-gray-500">
                                Signer: <span className="text-nexus-cyan font-mono">{getWalletAddress().slice(0, 10)}...</span>
                            </div>
                            <div className="text-xs text-gray-500">
                                Target: <span className="text-yellow-500 font-mono">{deployedAddress.slice(0, 10)}...</span>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-nexus-cyan hover:bg-cyan-400 text-black font-bold h-12"
                            onClick={handleExecute}
                            isLoading={isExecuting}
                            disabled={!selectedFunction || !wcSession}
                            icon={<Play className="w-4 h-4" />}
                        >
                            Sign & Broadcast
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Bottom: Logs */}
            <Card className="bg-black border-nexus-800 font-mono text-xs h-48 overflow-y-auto custom-scrollbar p-0">
                <div className="sticky top-0 bg-nexus-900/80 backdrop-blur border-b border-nexus-800 px-4 py-2 text-gray-500 text-[10px] uppercase font-bold">
                    Transaction Logs
                </div>
                <div className="p-4 space-y-1">
                    {logs.length === 0 && <span className="text-gray-700">Waiting for interaction...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="text-gray-400 border-b border-gray-900/50 pb-0.5 last:border-0">
                            {log}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
};
