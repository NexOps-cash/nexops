import React, { useState, useEffect } from 'react';
import { ContractArtifact, ExecutionRecord } from '../types';
import { Button, Badge, Modal, Input, Card } from './UI';
import {
    Play, Terminal, Activity, CheckCircle,
    ArrowRight, Wallet, ChevronRight, AlertCircle,
    Cpu, Hash, ArrowLeft, Loader2, ShieldAlert,
    ExternalLink, History, Clock, Zap, ChevronDown, ChevronUp
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
    network?: string;
    initialUtxo?: any;
    onConfigChange?: (args: string[]) => void;
    // Props for burner (lifted to ProjectWorkspace)
    burnerWif?: string;
    burnerAddress?: string;
    burnerPubkey?: string;
    onGenerateBurner?: () => void;
    isGeneratingBurner?: boolean;
    // Transaction History Props
    history?: ExecutionRecord[];
    onRecordTransaction?: (record: ExecutionRecord) => void;
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
    network = 'chipnet',
    initialUtxo,
    onConfigChange,
    burnerWif,
    burnerAddress,
    burnerPubkey,
    onGenerateBurner,
    isGeneratingBurner = false,
    history = [],
    onRecordTransaction
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
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(walletConnectService.getConnectionStatus());
    const isWCConnected = connectionStatus === ConnectionStatus.CONNECTED && walletConnectService.isConnected();
    const isWCExpired = connectionStatus === ConnectionStatus.EXPIRED;
    const isWCDisconnected = connectionStatus === ConnectionStatus.DISCONNECTED;

    // Burner Wallet State (Now from props)
    const [signingMethod, setSigningMethod] = useState<'walletconnect' | 'burner'>('walletconnect');
    const [isFundingBurner, setIsFundingBurner] = useState<boolean>(false);
    const [isBridging, setIsBridging] = useState<boolean>(false);

    // UTXO State
    const [contractUtxos, setContractUtxos] = useState<any[] | null>(initialUtxo ? [initialUtxo] : null);
    const [isFetchingUtxos, setIsFetchingUtxos] = useState(false);

    // Balance tracking
    const [totalBalance, setTotalBalance] = useState<number>(initialUtxo?.value || 0);
    const [unconfirmedContractBalance, setUnconfirmedContractBalance] = useState<number>(0);

    const [burnerBalance, setBurnerBalance] = useState<number>(0);
    const [unconfirmedBurnerBalance, setUnconfirmedBurnerBalance] = useState<number>(0);

    const [isAwaitingPropagation, setIsAwaitingPropagation] = useState(false);
    const [selectedUtxoIds, setSelectedUtxoIds] = useState<string[]>([]);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Parse ABI
    const functions = artifact.abi.filter(item => item.type === 'function' || !item.type);
    const constructorInputs = artifact.constructorInputs || [];

    // Constructor Args State
    const [internalConstructorArgs, setInternalConstructorArgs] = useState<string[]>([]);

    // Initialize/Sync constructor args
    useEffect(() => {
        if (constructorArgs && constructorArgs.length > 0) {
            setInternalConstructorArgs(constructorArgs);
        } else if (constructorInputs.length > 0) {
            // Fill with empty strings of correct length
            setInternalConstructorArgs(new Array(constructorInputs.length).fill(''));
        }
    }, [constructorArgs, constructorInputs]);

    // AUTO-FILL PUBKEY LOGIC
    useEffect(() => {
        const autoFillPubkeys = async () => {
            if (constructorInputs.length === 0) return;

            let updated = false;
            const newArgs = [...internalConstructorArgs];

            for (let i = 0; i < constructorInputs.length; i++) {
                const input = constructorInputs[i];
                if (input.type === 'pubkey') {
                    // Only fill if empty or matches expected pattern but we have better info
                    if (signingMethod === 'burner' && burnerPubkey) {
                        if (newArgs[i] !== burnerPubkey) {
                            newArgs[i] = burnerPubkey;
                            updated = true;
                        }
                    } else if (signingMethod === 'walletconnect' && walletConnectService.isConnected()) {
                        const pk = walletConnectService.getPublicKey();
                        if (pk && newArgs[i] !== pk) {
                            newArgs[i] = pk;
                            updated = true;
                        }
                    }
                }
            }

            if (updated) {
                console.log("[Autofill] Populated pubkey constructor arguments from wallet session.");
                setInternalConstructorArgs(newArgs);
                onConfigChange?.(newArgs);
            }
        };

        autoFillPubkeys();
    }, [signingMethod, burnerPubkey, constructorInputs, isWCConnected]);

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
        setIsModalOpen(true);
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

    // Sync initialUtxo to state when it changes
    useEffect(() => {
        if (initialUtxo) {
            setContractUtxos([initialUtxo]);
            setTotalBalance(initialUtxo.value);
            // Auto-select initial UTXO
            setSelectedUtxoIds([`${initialUtxo.txid}:${initialUtxo.vout}`]);
        }
    }, [initialUtxo]);

    // Fetch UTXOs when component mounts or address changes
    // Monitor addresses using subscriptions for "instant" updates
    useEffect(() => {
        if (!deployedAddress) return;

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
    }, [deployedAddress, burnerAddress]);

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
            const amount = BigInt(burnerBalance || 0) - fee;

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
    const handleGenerateBurner = () => {
        onGenerateBurner?.();
    };

    // --- Real Execution Logic ---
    const handleExecute = async () => {
        if (!selectedFunction) return;

        // NEW: Validate Constructor Arguments (Mandatory for instantiation)
        if (constructorInputs.length > 0 && internalConstructorArgs.length !== constructorInputs.length) {
            setExecutionResult({
                success: false,
                error: `Configuration Error: Expected ${constructorInputs.length} constructor arguments, but found ${internalConstructorArgs.length}.`
            });
            setIsExecuting(false);
            return;
        }

        const missingArgs = constructorInputs.filter((_, i) => !internalConstructorArgs[i]);
        if (missingArgs.length > 0) {
            const names = missingArgs.map(a => a.name).join(', ');
            setExecutionResult({
                success: false,
                error: `Missing Constructor Arguments: ${names}. Please provide them in the Contract Config section on the right.`
            });
            setIsExecuting(false);
            return;
        }

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
            const { Contract, ElectrumNetworkProvider, SignatureTemplate, Network: CashScriptNetwork } = await import('cashscript');

            // Reuse existing connection if possible, or new one
            // Note: ElectrumNetworkProvider manages its own connection
            // Force Chipnet and the EXACT same server used by the watcher
            // to ensure UTXO visibility and successful broadcasting.
            const provider = new ElectrumNetworkProvider(CashScriptNetwork.CHIPNET, {
                hostname: 'chipnet.imaginary.cash'
            });
            console.log("Provider initialized with chipnet.imaginary.cash");

            // 2. Initialize Contract
            // Use INTERNAL constructor args (can be edited by user)
            // Sanitize to ensured no undefined values reach CashScript
            const sanitizedConstructorArgs = internalConstructorArgs.map(arg => arg || '');
            const contract = new Contract(artifact, sanitizedConstructorArgs, { provider }) as any;

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
                    const val = input.value || '0';
                    if (isNaN(Number(val))) throw new Error(`Invalid integer for ${input.name}`);
                    return BigInt(val);
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
            console.log("Preparing UTXOs from selected set...");

            // Use selected UTXOs from state instead of fetching from contract again
            // This ensures we spend exactly what the user sees and selects
            const selectedUtxos = contractUtxos?.filter(u =>
                selectedUtxoIds.includes(`${u.txid}:${u.vout}`)
            ) || [];

            if (selectedUtxos.length === 0) {
                // Fallback: If nothing selected but we have UTXOs, use the first one (prev behavior)
                // but warn the user or just error out for "Coin Control" safety.
                if (contractUtxos && contractUtxos.length > 0) {
                    throw new Error("Please select at least one UTXO from the list on the right.");
                }
                throw new Error("No UTXOs found for this contract. Please fund it first.");
            }

            console.log(`Using ${selectedUtxos.length} selected UTXOs for transaction.`);

            // Import TransactionBuilder class
            const { TransactionBuilder: CashScriptTransactionBuilder } = await import('cashscript');
            const txBuilder = new CashScriptTransactionBuilder({ provider });

            // Get the unlocker (Redeem Script + Args)
            const unlocker = contract.unlock[selectedFunction](...typedArgs);

            // Add all selected inputs with correct shape for CashScript TransactionBuilder
            selectedUtxos.forEach(utxo => {
                txBuilder.addInput({
                    txid: utxo.txid,
                    vout: utxo.vout,
                    satoshis: BigInt(utxo.value)
                }, unlocker);
            });

            // 5. Configure Transaction
            const totalInput = selectedUtxos.reduce(
                (sum, u) => sum + BigInt(u.value),
                0n
            );
            const fee = 1000n;
            const sendAmount = totalInput - fee;

            if (sendAmount <= 0n) {
                throw new Error(`Insufficient funds: Total selected value (${totalInput} sats) is less than or equal to the fee (${fee} sats).`);
            }

            const walletAddress = signingMethod === 'burner' ? burnerAddress : getWalletAddress();
            console.log("Using wallet address for output:", walletAddress);

            if (walletAddress && walletAddress !== 'Not Connected') {
                // Use the wallet address directly (already has correct prefix and checksum)
                txBuilder.addOutput({ to: walletAddress, amount: sendAmount });
            } else {
                // Fallback to contract if no wallet
                txBuilder.addOutput({ to: contract.address, amount: sendAmount });
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

                // NEW: Use libauth to decode hex to TransactionCommon for Paytaca/Standard wallets
                const { decodeTransaction, hexToBin, cashAddressToLockingBytecode } = await import('@bitauth/libauth');

                const transaction = decodeTransaction(hexToBin(unsignedHex as string));
                if (typeof transaction === 'string') throw new Error(transaction);

                // Prepare sourceOutputs for the wallet to verify the transaction
                const lockResult = cashAddressToLockingBytecode(deployedAddress);
                if (typeof lockResult === 'string') throw new Error(lockResult);

                const sourceOutputs = selectedUtxos.map(u => ({
                    lockingBytecode: lockResult.bytecode,
                    valueSatoshis: BigInt(u.value)
                }));

                // 7. Request Signature from Wallet
                console.log("Requesting signature via WalletConnect (Structured)...");
                // Note: The service now uses the approved chain from the session, but we pass the correct mapping here as well
                const wcChainId = (network === 'mainnet' || network === 'main') ? 'bch:bitcoincash' : 'bch:bchtest';

                console.log("WC PAYLOAD:", {
                    transaction,
                    sourceOutputs,
                    chainId: wcChainId
                });

                signedHex = await walletConnectService.requestSignature(transaction, sourceOutputs, wcChainId);
                console.log("Signed Hex (Post-Sign):", signedHex);
            }

            // 8. Broadcast
            console.log("Selected UTXOs:", selectedUtxos);
            console.log("Network:", network);
            console.log("Provider network:", (provider as any).network);
            console.log("Broadcasting...");
            const txid = await provider.sendRawTransaction(signedHex);

            setExecutionResult({
                success: true,
                txid: txid
            });

            // Record transaction to history
            onRecordTransaction?.({
                txid: txid,
                funcName: selectedFunction,
                args: inputs.map(i => i.value),
                timestamp: Date.now(),
                network: network
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
        const address = walletConnectService.getAddress();
        if (!address) return 'Not Connected';
        return address;
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
                return;
            }

            // The service now handles mapping internal 'network' to CAIP-2
            await walletConnectService.connect(network);
        } catch (error) {
            console.error("Connection failed:", error);
        }
    };

    // Listen for connection success to close QR
    useEffect(() => {
        const handleSessionConnected = () => {
            // Handled by modal closing and status sub
        };
        walletConnectService.on('session_connected', handleSessionConnected);
        return () => {
            walletConnectService.off('session_connected', handleSessionConnected);
        };
    }, []);

    const renderStep3_Preview = () => {
        // Use component level helpers
        const isConnected = isWCConnected;
        const isExpired = isWCExpired;
        const isDisconnected = isWCDisconnected;

        const networkPrefix = (network === 'mainnet' || network === 'main') ? 'bitcoincash:' : 'bchtest:';

        const getQrValue = (addr: string) => {
            if (!addr) return '';
            return addr.includes(':') ? addr : `${networkPrefix}${addr}`;
        };

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* HERO SECTION: Contract Status */}
                {totalBalance > 0 ? (
                    <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-6 text-center space-y-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/40">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Contract Active</h3>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <span className="text-2xl font-mono font-black text-green-400">{totalBalance.toLocaleString()}</span>
                                <span className="text-xs text-green-500/60 font-bold uppercase tracking-widest mt-1">Sats</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] pt-2">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-nexus-cyan" />
                                Live on Chipnet
                            </div>
                            <div className="w-1 h-1 rounded-full bg-gray-700" />
                            <div className="flex items-center gap-1.5">
                                <ShieldAlert className="w-3 h-3 text-nexus-cyan" />
                                Secured
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-2xl p-8 text-center space-y-4">
                        <div className="w-12 h-12 bg-nexus-cyan/20 rounded-full flex items-center justify-center mx-auto border border-nexus-cyan/40 animate-pulse">
                            <Zap className="w-6 h-6 text-nexus-cyan" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Activate Contract</h3>
                            <p className="text-xs text-gray-400 mt-1">Send funds to the contract to enable interaction.</p>
                        </div>

                        <div className="flex items-center justify-center gap-6 pt-2">
                            <div className="bg-white p-2 rounded-xl shadow-lg shadow-nexus-cyan/10">
                                <QRCodeSVG value={getQrValue(deployedAddress || '')} size={100} />
                            </div>
                            <div className="text-left space-y-2">
                                <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Target Address</div>
                                <div className="font-mono text-[11px] text-nexus-cyan bg-nexus-cyan/10 px-3 py-2 rounded-lg border border-nexus-cyan/20 max-w-[180px] break-all">
                                    {deployedAddress}
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(deployedAddress);
                                        toast.success("Address copied");
                                    }}
                                    className="text-[10px] font-bold text-nexus-cyan hover:text-white transition-colors"
                                >
                                    Copy Address
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                variant="glass"
                                size="sm"
                                className="w-auto px-6 border-nexus-cyan/20 hover:bg-nexus-cyan/10"
                                onClick={() => handleAutoFund(deployedAddress)}
                                isLoading={isFundingBurner}
                            >
                                <Zap className="w-3 h-3 mr-2" />
                                Auto-Fund with Faucet
                            </Button>
                        </div>
                    </div>
                )}

                {/* FUNCTION DETAILS */}
                <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Target Function</span>
                        <Badge variant="ghost" className="bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20 font-mono py-1 px-3">
                            {selectedFunction}()
                        </Badge>
                    </div>

                    {constructorInputs.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configuration</span>
                            <div className="grid grid-cols-1 gap-2">
                                {constructorInputs.map((input, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2.5 bg-black/30 rounded-xl border border-white/5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-500 font-bold uppercase">{input.name}</span>
                                            <span className="text-[9px] text-nexus-cyan/60 font-mono truncate max-w-[150px]">{internalConstructorArgs[idx]}</span>
                                        </div>
                                        <button
                                            onClick={() => setCurrentStep(2)}
                                            className="text-[9px] font-bold text-gray-500 hover:text-white transition-colors uppercase"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ADVANCED DETAILS: Collapsible */}
                <div className="border-t border-white/5 pt-4">
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center justify-between w-full text-[10px] font-bold text-gray-500 hover:text-white transition-all uppercase tracking-widest py-2"
                    >
                        <span>Advanced Details</span>
                        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showAdvanced && (
                        <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* UTXOs */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">UTXO Inventory</span>
                                    <button onClick={loadUtxos} className="text-[9px] text-nexus-cyan font-bold hover:underline">Refresh</button>
                                </div>
                                <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                    {contractUtxos && contractUtxos.length > 0 ? (
                                        contractUtxos.map((u, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] p-2 bg-black/40 rounded-lg border border-white/5 font-mono">
                                                <span className="text-gray-500">{u.txid.slice(0, 10)}...:{u.vout}</span>
                                                <span className="text-nexus-cyan">{u.value.toLocaleString()} sats</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-4 text-[10px] text-gray-600 italic border border-dashed border-white/10 rounded-lg">No outputs detected</div>
                                    )}
                                </div>
                            </div>

                            {/* Signing Info / Switcher */}
                            <div className="p-4 bg-nexus-cyan/5 border border-nexus-cyan/10 rounded-2xl">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="text-[10px] font-black text-nexus-cyan/80 uppercase tracking-widest">Signing Identity</div>
                                    <div className="flex bg-black/40 p-1 rounded-lg border border-white/5">
                                        <button
                                            onClick={() => setSigningMethod('walletconnect')}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all ${signingMethod === 'walletconnect' ? 'bg-nexus-cyan text-nexus-900 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            WalletConnect
                                        </button>
                                        <button
                                            onClick={() => setSigningMethod('burner')}
                                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-tighter rounded-md transition-all ${signingMethod === 'burner' ? 'bg-nexus-cyan text-nexus-900 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
                                        >
                                            Test Wallet
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signingMethod === 'burner' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                            <Wallet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white font-bold leading-none">
                                                {signingMethod === 'burner' ? 'Burner Wallet' : (wcSession?.peer?.metadata?.name || 'WalletConnect')}
                                            </p>
                                            <p className="text-[9px] font-mono text-gray-500 mt-1">
                                                {signingMethod === 'burner'
                                                    ? (burnerAddress ? `${burnerAddress.slice(0, 10)}...${burnerAddress.slice(-8)}` : 'Not Generated')
                                                    : (walletConnectService.getAddress() ? `${walletConnectService.getAddress()?.slice(0, 10)}...${walletConnectService.getAddress()?.slice(-8)}` : 'Not Connected')}
                                            </p>
                                        </div>
                                    </div>
                                    {signingMethod === 'burner' && !burnerWif && (
                                        <button
                                            onClick={onGenerateBurner}
                                            className="text-[9px] font-black text-nexus-cyan hover:underline uppercase tracking-widest"
                                        >
                                            Generate
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* BOTTOM ROW: Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                    <Button variant="ghost" onClick={() => setCurrentStep(2)} size="sm">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Args
                    </Button>
                    <div className="flex items-center gap-3">
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
                            Execute Call
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
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-black/20">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center">
                        <Terminal className="w-3 h-3 mr-2 text-nexus-cyan" />
                        Available Actions
                    </h3>
                    {totalBalance > 0 ? (
                        <Badge variant="success" className="text-[9px] py-0 h-4 shadow-[0_0_10px_rgba(34,197,94,0.3)]">Funded: {totalBalance.toLocaleString()} sats</Badge>
                    ) : (
                        <Badge variant="warning" className="text-[9px] py-0 h-4">Awaiting Funding</Badge>
                    )}
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Select a function to build an execution transaction.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {functions.length === 0 ? (
                    <div className="text-center py-10 opacity-30">
                        <ShieldAlert className="w-10 h-10 mx-auto mb-3" />
                        <p className="text-xs uppercase font-bold">No Public Functions</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                        {functions.map(func => (
                            <button
                                key={func.name}
                                onClick={() => handleFunctionSelect(func.name)}
                                className="flex items-center justify-between w-full p-3.5 bg-nexus-900/40 border border-white/5 hover:border-nexus-cyan/40 hover:bg-nexus-cyan/5 rounded-xl transition-all group text-left relative overflow-hidden"
                            >
                                <div className="relative z-10">
                                    <div className="font-mono text-nexus-cyan font-black text-sm group-hover:text-white transition-colors">{func.name}</div>
                                    <div className="flex items-center mt-1 space-x-2">
                                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-tighter">Arguments:</span>
                                        <span className="text-[10px] text-slate-300 font-mono italic">{func.inputs.length > 0 ? func.inputs.map(i => i.type).join(', ') : 'none'}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-nexus-cyan group-hover:translate-x-0.5 transition-all relative z-10" />
                                <div className="absolute inset-0 bg-gradient-to-r from-nexus-cyan/0 via-nexus-cyan/0 to-nexus-cyan/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                )}

                {totalBalance === 0 && (
                    <div className="mt-6 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-3">
                        <div className="flex items-center text-yellow-500 text-[11px] font-black uppercase tracking-wider">
                            <AlertCircle className="w-3 h-3 mr-2" />
                            Funding Required
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                            To interact with this contract, you must first send funds to the contract address found in the <span className="text-slate-200">Deploy</span> tab.
                        </p>
                        <Button
                            variant="glass"
                            size="sm"
                            className="w-full text-[9px] font-black border-yellow-500/20 hover:bg-yellow-500/10 text-yellow-500/70 hover:text-yellow-500"
                            onClick={() => handleAutoFund(deployedAddress)}
                            isLoading={isFundingBurner}
                        >
                            <Zap size={10} className="mr-2" />
                            Auto-Fund with Faucet
                        </Button>
                    </div>
                )}

                <TransactionHistory history={history} />
            </div>

            {/* Wizard Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                className="max-w-4xl w-[95vw]"
                title={
                    currentStep === 1 ? "Select Function" :
                        currentStep === 2 ? "Configure Arguments" :
                            currentStep === 3 ? "Review Transaction" :
                                "Execution Status"
                }
            >
                <div className="max-h-[65vh] overflow-y-auto custom-scrollbar px-1 -mx-1">
                    {currentStep === 1 && renderStep1_Select()}
                    {currentStep === 2 && renderStep2_Args()}
                    {currentStep === 3 && renderStep3_Preview()}
                    {currentStep === 4 && renderStep4_Result()}
                </div>
            </Modal>
        </div>
    );
};

// --- Standalone History Component ---
export const TransactionHistory: React.FC<{
    history: ExecutionRecord[];
}> = ({ history }) => {
    if (!history || history.length === 0) return null;

    return (
        <div className="mt-8 space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                    <History size={12} className="text-nexus-cyan" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Execution History</span>
                </div>
                <Badge variant="ghost" className="text-[10px] opacity-50 uppercase font-black">{history.length} SPENDS</Badge>
            </div>

            <div className="space-y-2">
                {[...history].reverse().map((record, idx) => (
                    <div
                        key={idx}
                        className="bg-black/40 border border-white/5 rounded-xl p-3 group hover:border-nexus-cyan/30 transition-all"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 rounded-full bg-nexus-cyan/10 flex items-center justify-center border border-nexus-cyan/20">
                                    <Play size={10} className="text-nexus-cyan" />
                                </div>
                                <span className="font-mono text-xs font-black text-white">{record.funcName}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-slate-500">
                                <Clock size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-tighter">
                                    {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-wrap gap-1.5 flex-1 min-w-0 mr-2">
                                {record.args.map((arg, i) => (
                                    <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-white/5 text-slate-400 rounded border border-white/5 truncate max-w-[80px]">
                                        {arg}
                                    </span>
                                ))}
                            </div>
                            <button
                                onClick={() => window.open(getExplorerLink(record.txid), '_blank')}
                                className="p-1.5 bg-white/5 hover:bg-nexus-cyan/10 text-slate-500 hover:text-nexus-cyan rounded-lg border border-white/5 hover:border-nexus-cyan/20 transition-all flex items-center space-x-1 shrink-0"
                            >
                                <span className="text-[9px] font-black tracking-widest uppercase ml-1">View</span>
                                <ExternalLink size={10} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
