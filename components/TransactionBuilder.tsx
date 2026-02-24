import React, { useState, useEffect } from 'react';
import { ContractArtifact } from '../services/compilerService';
import { Button, Badge, Modal, Input, Card } from './UI';
import {
    Play, Terminal, Activity, CheckCircle,
    ArrowRight, Wallet, ChevronRight, AlertCircle,
    Cpu, Hash, ArrowLeft, Loader2
} from 'lucide-react';
import { getExplorerLink, fetchUTXOs, subscribeToAddress } from '../services/blockchainService';
import { walletConnectService, ConnectionStatus } from '../services/walletConnectService';
import { QRCodeSVG } from 'qrcode.react';
import LocalWalletService from '../services/localWalletService';
import toast from 'react-hot-toast';
import { decodeCashAddress } from '@bitauth/libauth';

interface TransactionBuilderProps {
    artifact: ContractArtifact;
    deployedAddress: string;
    constructorArgs: string[];
    wcSession: any;
    network?: string; // Optional network prop
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
    wcSession,
    network = 'testnet' // Default to testnet
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
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(walletConnectService.getConnectionStatus());

    // Burner Wallet State
    const [signingMethod, setSigningMethod] = useState<'walletconnect' | 'burner'>('walletconnect');
    const [burnerWif, setBurnerWif] = useState<string>('');
    const [burnerAddress, setBurnerAddress] = useState<string>('');
    const [isFundingBurner, setIsFundingBurner] = useState<boolean>(false);

    // UTXO State
    const [contractUtxos, setContractUtxos] = useState<any[] | null>(null);
    const [isFetchingUtxos, setIsFetchingUtxos] = useState(false);

    // Balance tracking
    const [totalBalance, setTotalBalance] = useState<number>(0);
    const [unconfirmedContractBalance, setUnconfirmedContractBalance] = useState<number>(0);

    const [burnerBalance, setBurnerBalance] = useState<number>(0);
    const [unconfirmedBurnerBalance, setUnconfirmedBurnerBalance] = useState<number>(0);

    const [isAwaitingPropagation, setIsAwaitingPropagation] = useState(false);

    // Parse ABI
    const functions = artifact.abi.filter(item => item.type === 'function' || !item.type);
    const constructorDef = artifact.abi.find(item => item.type === 'constructor');

    // Constructor Args State
    const [internalConstructorArgs, setInternalConstructorArgs] = useState<string[]>(constructorArgs || []);

    // Reset state when modal opens
    const openModal = () => {
        setIsModalOpen(true);
        setCurrentStep(1);
        setExecutionResult(null);
        setSelectedFunction('');
        setInputs([]);
        setInternalConstructorArgs(constructorArgs || []);
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

    // Sync initial connection status on mount
    useEffect(() => {
        // Update status immediately in case service already initialized
        setConnectionStatus(walletConnectService.getConnectionStatus());
    }, []);

    // Listen for connection status changes
    useEffect(() => {
        const handleStatusChange = (status: ConnectionStatus) => {
            console.log('TransactionBuilder: Status changed to', status);
            setConnectionStatus(status);
        };

        walletConnectService.on('connection_status_changed', handleStatusChange);
        return () => {
            walletConnectService.off('connection_status_changed', handleStatusChange);
        };
    }, []);

    // Fetch UTXOs when modal opens or step changes to 3
    // Monitor addresses using subscriptions for "instant" updates
    useEffect(() => {
        if (!isModalOpen) return;

        let unsubs: (() => void)[] = [];

        async function setupSubscriptions() {
            // Subscribe to Contract
            if (deployedAddress) {
                console.log(`[Sync] Subscribing to contract: ${deployedAddress}`);
                const unsub = await subscribeToAddress(deployedAddress, (utxos) => {
                    setContractUtxos(utxos);

                    const confirmedValue = utxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
                    const unconfirmedValue = utxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

                    setTotalBalance(confirmedValue + unconfirmedValue);
                    setUnconfirmedContractBalance(unconfirmedValue);

                    if (confirmedValue + unconfirmedValue > 0) setIsAwaitingPropagation(false);
                });
                unsubs.push(unsub);
            }

            // Subscribe to Burner
            if (burnerAddress) {
                console.log(`[Sync] Subscribing to burner: ${burnerAddress}`);
                const unsub = await subscribeToAddress(burnerAddress, (utxos) => {
                    const confirmedValue = utxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
                    const unconfirmedValue = utxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

                    setBurnerBalance(confirmedValue + unconfirmedValue);
                    setUnconfirmedBurnerBalance(unconfirmedValue);

                    if (confirmedValue + unconfirmedValue > 0) setIsAwaitingPropagation(false);
                });
                unsubs.push(unsub);
            }
        }

        setupSubscriptions();

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [isModalOpen, deployedAddress, burnerAddress]);

    const loadUtxos = async () => {
        if (!deployedAddress) return;
        setIsFetchingUtxos(true);
        try {
            const utxos = await fetchUTXOs(deployedAddress);
            setContractUtxos(utxos);

            const confirmedValue = utxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
            const unconfirmedValue = utxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

            setTotalBalance(confirmedValue + unconfirmedValue);
            setUnconfirmedContractBalance(unconfirmedValue);

            if (confirmedValue + unconfirmedValue > 0) setIsAwaitingPropagation(false);

            // Also check burner if active
            if (burnerAddress) {
                const bUtxos = await fetchUTXOs(burnerAddress);
                const bConfirmedValue = bUtxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
                const bUnconfirmedValue = bUtxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

                setBurnerBalance(bConfirmedValue + bUnconfirmedValue);
                setUnconfirmedBurnerBalance(bUnconfirmedValue);

                if (bConfirmedValue + bUnconfirmedValue > 0) setIsAwaitingPropagation(false);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingUtxos(false);
        }
    };

    useEffect(() => {
        if (isModalOpen && currentStep === 3) {
            loadUtxos();
        }
    }, [isModalOpen, currentStep, deployedAddress]);

    // Fallback polling for 0-conf propagation
    useEffect(() => {
        let intervalId: any;
        if (isAwaitingPropagation) {
            intervalId = setInterval(() => {
                console.log(`[Sync] Polling UTXOs while awaiting propagation...`);
                loadUtxos();
            }, 1500); // Poll every 1.5 seconds for instant demo UX
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isAwaitingPropagation, deployedAddress, burnerAddress]);

    /**
     * Reusable Faucet function
     */
    const handleAutoFund = async (targetAddress: string) => {
        if (!targetAddress) return;
        setIsFundingBurner(true);
        try {
            // Validate address format and type
            const decoded = decodeCashAddress(targetAddress);
            if (typeof decoded === 'string') {
                toast.error('Invalid address format: ' + decoded);
                return;
            }

            // Faucets typically only support P2PKH
            if (decoded.type === 'p2sh') {
                toast.error('Faucet limitation: Only P2PKH (wallet) addresses can be funded. Contracts must be funded from a wallet.', {
                    duration: 5000,
                    id: 'faucet_p2sh_warn'
                });
                return;
            }

            // The rest-unstable faucet expects a properly prefixed address
            const formattedAddress = targetAddress.includes(':') ? targetAddress : `bchtest:${targetAddress}`;

            console.log(`[Faucet] Requesting funds for: ${formattedAddress} (Type: ${decoded.type})`);

            const response = await fetch('https://rest-unstable.mainnet.cash/faucet/get_testnet_bch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cashaddr: formattedAddress }),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                data = { error: 'Server returned non-JSON response' };
            }

            // Diagnostic logging for the 405 error (which means Incorrect cashaddr in this API)
            console.log(`[Faucet] Response Status: ${response.status}`);
            console.log(`[Faucet] Response Body:`, data);

            if (response.status === 405) {
                toast.error('Faucet Error (405): The server rejected this address. Ensure it is a valid P2PKH Testnet address.', { id: 'fund_405' });
                return;
            }

            if (data.txId) {
                toast.success('Testnet gas secured! TX: ' + data.txId.slice(0, 10) + '...', { id: 'fund_success' });
                // Trigger propagation UI (Subscription & Polling will handle the update)
                setIsAwaitingPropagation(true);
                // Immediately check once
                loadUtxos();
            } else if (data.error) {
                toast.error('Funding failed: ' + data.error, { id: 'fund_err' });
            } else {
                toast.success('Funds requested. Awaiting network confirmation.', { id: 'fund_req' });
                setIsAwaitingPropagation(true);
                loadUtxos();
            }
        } catch (error: any) {
            console.error("Faucet error details:", error);
            toast.error('Funding API unreachable. Check network connection.', { id: 'fund_catch' });
        } finally {
            setIsFundingBurner(false);
        }
    };

    // Bridge funds from Burner to Contract
    const [isBridging, setIsBridging] = useState(false);

    const handleBridgeFunds = async () => {
        if (!burnerWif || !deployedAddress) return;
        setIsBridging(true);
        const loadingToast = toast.loading('Initiating bridge transfer to contract...', { id: 'bridge_load' });

        try {
            const { Contract, SignatureTemplate, ElectrumNetworkProvider } = await import('cashscript');
            const { decodePrivateKeyWif, instantiateSecp256k1, instantiateRipemd160, sha256 } = await import('@bitauth/libauth');

            const provider = new ElectrumNetworkProvider(network as any);

            // 1. Derive Public Key and PKH from WIF
            const decoded = decodePrivateKeyWif(burnerWif);
            if (typeof decoded === 'string') throw new Error(decoded);

            const secp256k1 = await instantiateSecp256k1();
            const ripemd160 = await instantiateRipemd160();
            const pubkey = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
            if (typeof pubkey === 'string') throw new Error(pubkey);
            const pkh = ripemd160.hash(sha256.hash(pubkey));

            // 2. Define minimal P2PKH artifact for CashScript
            const p2pkhArtifact: any = {
                contractName: 'P2PKH',
                constructorInputs: [{ name: 'pkh', type: 'bytes20' }],
                abi: [{ name: 'spend', type: 'function', inputs: [{ name: 'pk', type: 'pubkey' }, { name: 's', type: 'sig' }] }],
                bytecode: '78a988ac', // OP_OVER OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG
            };

            // 3. Initialize Contract and Signer
            const contract = new Contract(p2pkhArtifact, [pkh], { provider });
            const signer = new SignatureTemplate(burnerWif);

            // 4. Calculate amount (Sweep minus fee)
            const fee = 1000n;
            const amount = BigInt(burnerBalance) - fee;

            if (amount <= 500n) {
                toast.error('Insufficient burner funds (min ~1500 sats needed).', { id: 'bridge_load' });
                return;
            }

            console.log(`[Bridge] Sweeping ${amount} sats from Burner -> Contract`);

            // 5. Build and Broadcast
            const tx = await (contract as any).functions
                .spend(pubkey, signer)
                .to(deployedAddress, amount)
                .send();

            toast.success(`Bridge Success! ${amount.toLocaleString()} sats sent.`, { id: 'bridge_load' });
            console.log('[Bridge] TXID:', tx.txid);

            // The subscription will handle the UI update
        } catch (e: any) {
            console.error('Bridge failed:', e);
            toast.error('Bridge failed: ' + (e.message || 'Unknown error'), { id: 'bridge_load' });
        } finally {
            setIsBridging(false);
        }
    };
    const handleGenerateBurner = async () => {
        try {
            const wif = await LocalWalletService.generateBurnerWIF();
            const address = await LocalWalletService.getAddressFromWIF(wif);
            setBurnerWif(wif);
            setBurnerAddress(address);
        } catch (e) {
            console.error("Failed to generate burner:", e);
        }
    };

    // --- Real Execution Logic ---
    const handleExecute = async () => {
        if (!selectedFunction) return;

        // Guard: Check wallet connection based on method
        if (signingMethod === 'walletconnect' && !walletConnectService.isConnected()) {
            setExecutionResult({
                success: false,
                error: 'Wallet not connected. Please connect your wallet first.'
            });
            setIsExecuting(false);
            return;
        }

        if (signingMethod === 'burner' && !burnerWif) {
            setExecutionResult({
                success: false,
                error: 'Burner wallet not generated.'
            });
            setIsExecuting(false);
            return;
        }

        // 1. Setup Provider & Signer
        setIsExecuting(true);
        setExecutionResult(null);

        try {
            // Import dynamically to avoid SSR/Init issues if any
            const { Contract, ElectrumNetworkProvider, SignatureTemplate } = await import('cashscript');

            // Reuse existing connection if possible, or new one
            // Note: ElectrumNetworkProvider manages its own connection
            const provider = new ElectrumNetworkProvider(network as any);

            // 2. Initialize Contract
            // Use INTERNAL constructor args (can be edited by user)
            const contract = new Contract(artifact, internalConstructorArgs, { provider }) as any;

            if (deployedAddress && contract.address !== deployedAddress) {
                console.warn("Warning: initialized contract address differs from derived address:", contract.address, deployedAddress);
            }
            console.log('Contract initialized:', contract);
            console.log('Available functions:', contract.functions); // Debugging line

            // 3. Prepare Arguments
            const func = functions.find(f => f.name === selectedFunction);
            if (!func) throw new Error("Function not found");

            // Setup Signature Template based on method
            // If Burner, use real WIF to sign. If WalletConnect, use dummy key to bypass local signing.
            const createWCTemplate = () => {
                if (signingMethod === 'burner') {
                    return new SignatureTemplate(burnerWif);
                } else {
                    const dummyKey = new Uint8Array(32).fill(1);
                    const wcTemplate = new SignatureTemplate(dummyKey);
                    wcTemplate.generateSignature = (_payload: any, _bchForkId: any) => new Uint8Array(65).fill(0);
                    return wcTemplate;
                }
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
            const walletAddress = signingMethod === 'burner' ? burnerAddress : getWalletAddress();
            console.log("Using wallet address for output:", walletAddress);

            if (walletAddress && walletAddress !== 'Not Connected') {
                // Ensure correct prefix for the network
                const addressWithPrefix = (network === 'mainnet' || network === 'main')
                    ? (walletAddress.startsWith('bitcoincash:') ? walletAddress : `bitcoincash:${walletAddress}`)
                    : (walletAddress.startsWith('bchtest:') ? walletAddress : `bchtest:${walletAddress}`);

                // Add output back to wallet (change or small return)
                // We also subtract a small amount for fees implicitly by not using the full UTXO
                txBuilder.addOutput({ to: addressWithPrefix, amount: 1000n });
            } else {
                txBuilder.addOutput({ to: contract.address, amount: 1000n });
            }

            // 6. Build Unsigned/Signed Transaction
            let signedHex: string;

            if (signingMethod === 'burner') {
                console.log("Signing locally with burner WIF...");
                const tx = await txBuilder.build();
                // cashscript build() returns the hex if all signatures are satisfied
                signedHex = typeof tx === 'string' ? tx : (tx as any).hex;
                console.log("Signed Hex (Local):", signedHex);
            } else {
                const unsignedHex = await txBuilder.build();
                console.log("Unsigned Hex (Pre-Sign):", unsignedHex);

                // 7. Request Signature from Wallet
                console.log("Requesting signature via WalletConnect...");
                const wcChainId = (network === 'mainnet' || network === 'main') ? 'bch:mainnet' : 'bch:testnet';
                signedHex = await walletConnectService.requestSignature(unsignedHex as string, wcChainId);
                console.log("Signed Hex (Post-Sign):", signedHex);
            }

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
        const session = walletConnectService.getSession();
        return session?.namespaces?.bch?.accounts?.[0]?.split(':')[2] || 'Not Connected';
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
            // Guard: If we're already connected globally, don't generate a new QR code.
            // Just update local state to reflect the connection.
            if (walletConnectService.isConnected()) {
                console.log("TransactionBuilder: Wallet already connected from a previous step.");
                setConnectionStatus(walletConnectService.getConnectionStatus());
                setConnectUri('');
                return;
            }

            const wcChainId = (network === 'mainnet' || network === 'main') ? 'bch:mainnet' : 'bch:testnet';
            const uri = await walletConnectService.connect(wcChainId);
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
        };
        walletConnectService.on('session_connected', handleSessionConnected);
        return () => {
            walletConnectService.off('session_connected', handleSessionConnected);
        };
    }, []);

    const renderStep3_Preview = () => {
        const isConnected = connectionStatus === ConnectionStatus.CONNECTED && walletConnectService.isConnected();
        const isExpired = connectionStatus === ConnectionStatus.EXPIRED;
        const isDisconnected = connectionStatus === ConnectionStatus.DISCONNECTED;

        const networkPrefix = (network === 'mainnet' || network === 'main') ? 'bitcoincash:' : 'bchtest:';

        const getQrValue = (addr: string) => {
            if (!addr) return '';
            return addr.includes(':') ? addr : `${networkPrefix}${addr}`;
        };

        return (
            <div className="flex flex-col h-full space-y-4">
                <div className="flex flex-col md:flex-row gap-6">

                    {/* LEFT COLUMN: Signing Method & Wallet Details */}
                    <div className="flex-1 space-y-4">
                        {/* Method Toggle */}
                        <div className="flex bg-nexus-900 border border-nexus-700 rounded-lg p-1">
                            <button
                                onClick={() => setSigningMethod('walletconnect')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${signingMethod === 'walletconnect' ? 'bg-nexus-cyan text-nexus-900' : 'text-gray-400 hover:text-white'}`}
                            >
                                WalletConnect (Secure)
                            </button>
                            <button
                                onClick={() => setSigningMethod('burner')}
                                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${signingMethod === 'burner' ? 'bg-nexus-pink text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                                Burner Wallet (Dev)
                            </button>
                        </div>

                        {/* Burner Wallet Card */}
                        {signingMethod === 'burner' && (
                            <div className="bg-nexus-900 border border-nexus-pink/50 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 h-full min-h-[300px]">
                                <div className="p-4 border-b border-nexus-pink/20 bg-nexus-pink/5">
                                    <h4 className="text-xs font-bold text-nexus-pink uppercase tracking-widest flex items-center justify-between">
                                        <span className="flex items-center"><Terminal className="w-3 h-3 mr-2" /> Ephemeral Burner</span>
                                        <Badge variant="warning">Testnet Only</Badge>
                                    </h4>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="text-xs text-nexus-pink/80 flex items-start gap-2 bg-nexus-pink/10 p-3 rounded-lg border border-nexus-pink/20">
                                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <p><strong>DO NOT USE MAINNET KEYS.</strong> This burner is stored entirely in memory. Use only for fast Testnet testing.</p>
                                    </div>

                                    {!burnerWif ? (
                                        <div className="flex flex-col items-center justify-center py-6">
                                            <Button onClick={handleGenerateBurner} variant="secondary" className="w-full">
                                                Generate Ephemeral Key
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Burner Address</label>
                                                <div className="flex items-center gap-3 bg-black/30 p-3 rounded-lg border border-nexus-700 mt-1">
                                                    <div className="bg-white p-1 rounded-sm shrink-0">
                                                        <QRCodeSVG value={getQrValue(burnerAddress)} size={48} />
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-right">
                                                        <div className="text-[10px] text-gray-500 uppercase flex justify-between items-center mb-1">
                                                            <span>Balance</span>
                                                            <div className="flex items-center gap-2">
                                                                {unconfirmedBurnerBalance > 0 && (
                                                                    <Badge variant="warning" className="text-[8px] py-0 h-4">Unconfirmed (Spendable)</Badge>
                                                                )}
                                                                <span className="font-bold text-nexus-cyan">{burnerBalance.toLocaleString()} sats</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-mono text-nexus-cyan break-all block mt-1">{burnerAddress}</span>
                                                        {burnerBalance > 0 && totalBalance === 0 && (
                                                            <button
                                                                onClick={handleBridgeFunds}
                                                                disabled={isBridging || isAwaitingPropagation}
                                                                className="mt-2 text-[9px] font-bold uppercase tracking-widest text-nexus-pink hover:text-white transition-colors flex items-center gap-1 justify-end ml-auto"
                                                            >
                                                                <ArrowRight className={`w-3 h-3 ${isBridging ? 'animate-pulse' : ''}`} /> Top-up Contract
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 uppercase">Private Key (WIF)</label>
                                                <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-nexus-700 mt-1">
                                                    <span className="text-xs md:text-sm font-mono text-nexus-pink break-all">{burnerWif}</span>
                                                </div>
                                            </div>
                                            <div className="pt-2 flex flex-col gap-2">
                                                <Button
                                                    onClick={() => handleAutoFund(burnerAddress)}
                                                    disabled={isFundingBurner || isAwaitingPropagation}
                                                    variant="secondary"
                                                    className="w-full text-xs h-8 bg-nexus-cyan/10 hover:bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30"
                                                    icon={<Activity className={`w-3 h-3 ${isFundingBurner || isAwaitingPropagation ? 'animate-pulse' : ''}`} />}
                                                >
                                                    {isFundingBurner ? 'Requesting Protocol Funding...' : isAwaitingPropagation ? 'Syncing with Network...' : 'Request Testnet Gas Overlay'}
                                                </Button>
                                                <p className="text-[10px] text-gray-500 text-center uppercase tracking-widest">Fund the Burner Address to sign transactions.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* WalletConnect Card */}
                        {signingMethod === 'walletconnect' && (
                            <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 h-full min-h-[300px]">
                                <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                        <Wallet className="w-3 h-3 mr-2 text-nexus-pink" /> Transaction Signer
                                    </h4>
                                </div>
                                <div className="p-4 h-full flex flex-col items-center justify-center gap-4 py-8">
                                    {/* State 1: CONNECTED - Show wallet address */}
                                    {isConnected && (
                                        <div className="w-full flex flex-col items-center p-6 bg-nexus-900 border border-nexus-700 rounded-lg">
                                            <div className="w-16 h-16 rounded-full bg-nexus-cyan/20 flex flex-col items-center justify-center mb-4">
                                                <Wallet className="w-8 h-8 text-nexus-cyan" />
                                            </div>
                                            <p className="text-base font-bold text-white mb-2">Wallet Connected</p>
                                            <div className="text-xs text-nexus-cyan font-mono break-all text-center px-4">
                                                {walletConnectService.getAccount() || 'Session Active'}
                                            </div>
                                        </div>
                                    )}

                                    {/* State 2: EXPIRED - Show reconnect option */}
                                    {isExpired && (
                                        <div className="w-full text-center space-y-4">
                                            <div className="text-base text-yellow-400 font-bold">⚠ Session Expired</div>
                                            <p className="text-sm text-gray-400">Your wallet session has expired or disconnected</p>
                                            <Button size="sm" onClick={handleConnect} icon={<Wallet className="w-4 h-4" />}>
                                                Reconnect Wallet
                                            </Button>
                                        </div>
                                    )}

                                    {/* State 3: DISCONNECTED - Show connect option */}
                                    {isDisconnected && (
                                        <div className="w-full h-full flex items-center justify-center">
                                            {!connectUri ? (
                                                <Button size="lg" onClick={handleConnect} icon={<Wallet className="w-5 h-5" />}>
                                                    Connect Wallet
                                                </Button>
                                            ) : (
                                                <div className="flex flex-col items-center animate-in fade-in zoom-in">
                                                    <div className="bg-white p-3 rounded-xl mb-4 shadow-xl">
                                                        <QRCodeSVG value={connectUri} size={200} />
                                                    </div>
                                                    <p className="text-sm font-bold text-nexus-cyan mb-1">Scan to Connect</p>
                                                    <p className="text-xs text-gray-400">Use Paytaca or Zapit</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: UTXOs and Contract Details */}
                    <div className="flex-1 flex flex-col gap-4">

                        {/* UTXO Inspector */}
                        <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden flex-1 flex flex-col">
                            <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30 flex justify-between items-center shrink-0">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                    <Hash className="w-3 h-3 mr-2 text-nexus-cyan" /> Contract UTXOs
                                </h4>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-500 uppercase flex justify-between items-center mb-1">
                                            <span>Total Balance</span>
                                            {unconfirmedContractBalance > 0 && (
                                                <Badge variant="warning" className="text-[8px] py-0 h-4 ml-2">Unconfirmed (Spendable)</Badge>
                                            )}
                                        </div>
                                        <div className={`text-sm font-bold ${totalBalance > 0 ? 'text-nexus-cyan' : 'text-gray-500'}`}>
                                            {totalBalance.toLocaleString()} <span className="text-[10px]">SATS</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            loadUtxos();
                                        }}
                                        className="text-xs text-nexus-cyan hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        <Activity className={`w-3 h-3 ${isFetchingUtxos || isAwaitingPropagation ? 'animate-spin' : ''}`} /> Refresh
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                                {isAwaitingPropagation && totalBalance === 0 && (
                                    <div className="bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-lg p-3 mb-3 animate-pulse">
                                        <div className="flex items-center gap-2 text-nexus-cyan">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Awaiting Network Indexer...</span>
                                        </div>
                                        <p className="text-[9px] text-nexus-cyan/70 mt-1">Faucet transaction confirmed. Waiting for Electrum nodes to propagate the outcome.</p>
                                    </div>
                                )}

                                {isFetchingUtxos && !isAwaitingPropagation ? (
                                    <div className="m-auto text-center text-gray-500 text-xs flex flex-col items-center">
                                        <Loader2 className="w-6 h-6 text-nexus-cyan animate-spin mb-3" />
                                        Scanning Electrum...
                                    </div>
                                ) : contractUtxos && contractUtxos.length > 0 ? (
                                    <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-2">
                                        {contractUtxos.map((u, i) => (
                                            <div key={i} className="flex justify-between items-center text-xs p-3 bg-black/20 rounded-lg border border-nexus-700/50 hover:bg-black/40 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-nexus-cyan animate-pulse"></div>
                                                    <span className="font-mono text-gray-400 truncate w-32 md:w-48" title={`${u.txid}:${u.vout}`}>{u.txid.slice(0, 16)}...:{u.vout}</span>
                                                </div>
                                                <span className="font-mono text-nexus-cyan font-bold bg-nexus-cyan/10 px-2.5 py-1 rounded">{u.value} sats</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="m-auto text-center text-gray-500 text-sm flex flex-col items-center bg-black/20 p-6 rounded-xl border border-dashed border-nexus-700 w-full">
                                        <AlertCircle className="w-8 h-8 mb-3 text-yellow-500/80" />
                                        <p className="font-bold text-gray-300">No UTXOs Found</p>
                                        <p className="text-xs mt-1">The contract must be funded to execute calls.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contract Details & Parameters */}
                        <div className="bg-nexus-900 border border-nexus-700 rounded-xl overflow-hidden shrink-0">
                            <div className="p-4 border-b border-nexus-700/50 bg-nexus-800/30">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
                                    <Cpu className="w-3 h-3 mr-2 text-nexus-cyan" /> Contract Config
                                </h4>
                            </div>
                            <div className="p-4 space-y-4">
                                {/* Function Call Info */}
                                <div className="flex justify-between items-center text-sm border-b border-nexus-700/50 pb-2">
                                    <span className="text-gray-500">Target Function:</span>
                                    <span className="text-nexus-cyan font-mono font-bold bg-nexus-cyan/10 px-2 py-0.5 rounded">{selectedFunction}</span>
                                </div>

                                {/* Constructor Args Section */}
                                {constructorDef && constructorDef.inputs.length > 0 && (
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Constructor Arguments</label>
                                            <Badge variant="ghost" className="text-[10px] opacity-50">REQUIRED FOR INSTANTIATION</Badge>
                                        </div>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                            {constructorDef.inputs.map((input, idx) => (
                                                <div key={idx} className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-[10px] text-gray-500 uppercase">{input.name}</span>
                                                        <span className="text-[9px] text-nexus-cyan/50 font-mono">{input.type}</span>
                                                    </div>
                                                    <Input
                                                        value={internalConstructorArgs[idx] || ''}
                                                        onChange={(e) => {
                                                            const newArgs = [...internalConstructorArgs];
                                                            newArgs[idx] = e.target.value;
                                                            setInternalConstructorArgs(newArgs);
                                                        }}
                                                        placeholder={`Enter ${input.name}`}
                                                        className="font-mono text-xs bg-black/20 border-nexus-700/50 h-8"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Address QR */}
                                <div className="space-y-1 pt-2 border-t border-nexus-700/30">
                                    <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest">Contract Address</span>
                                    <div className="flex items-center gap-3 bg-black/30 p-2 rounded-lg border border-nexus-700/50">
                                        <div className="bg-white p-1 rounded-sm shrink-0">
                                            <QRCodeSVG value={getQrValue(deployedAddress || '')} size={36} />
                                        </div>
                                        <span className="text-gray-300 font-mono text-[10px] md:text-xs break-all flex-1">{deployedAddress}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* BOTTOM ROW: Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-nexus-700 mt-4">
                    <Button variant="ghost" onClick={() => setCurrentStep(2)} size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Args
                    </Button>
                    <div className="flex items-center gap-3">
                        {signingMethod === 'walletconnect' && !isConnected && (
                            <span className="text-xs text-gray-500 italic">Connect wallet to sign</span>
                        )}
                        {signingMethod === 'burner' && !burnerWif && (
                            <span className="text-xs text-gray-500 italic">Generate burner to sign</span>
                        )}
                        <Button
                            onClick={() => {
                                handleExecute();
                                setCurrentStep(4);
                            }}
                            disabled={signingMethod === 'walletconnect' ? !isConnected : !burnerWif}
                            variant={(signingMethod === 'walletconnect' ? isConnected : burnerWif) ? 'primary' : 'secondary'}
                            icon={<Play className="w-4 h-4" />}
                            className="px-8"
                        >
                            {(signingMethod === 'walletconnect' ? isConnected : burnerWif) ? 'Sign & Broadcast' : 'Ready to Sign?'}
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

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
                className="max-w-2xl w-[95vw]"
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
