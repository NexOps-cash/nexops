import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContractArtifact, ExecutionRecord, Project } from '../types';
import { useWallet } from '../contexts/WalletContext';
import { Button, Badge, Modal, Input, Card } from './UI';
import {
    Play, Terminal, Activity, CheckCircle,
    ArrowRight, Wallet, ChevronRight, AlertCircle,
    Cpu, Hash, ArrowLeft, Loader2, ShieldAlert,
    ExternalLink, History, Clock, Zap, ChevronDown, ChevronUp,
    RotateCcw
} from 'lucide-react';
import {
    getExplorerLink,
    fetchUTXOsWithTimeout,
    subscribeToAddress,
    requestFaucetFunds,
    getElectrumConnectionSnapshot,
    ELECTRUM_FALLBACK_SERVERS,
} from '../services/blockchainService';
import { walletConnectService, ConnectionStatus } from '../services/walletConnectService';
import { QRCodeSVG } from 'qrcode.react';
import LocalWalletService from '../services/localWalletService';
import { cashscriptBytesFromString } from '../services/cashscriptBytes';
import toast from 'react-hot-toast';
import { decodeCashAddress, cashAddressToLockingBytecode, binToHex } from '@bitauth/libauth';
import { coerceConstructorArgs, arbitrationEscrowSellerPayoutAddress } from '../services/addressService';
import type { FunctionMeta } from '../services/wizard/parseContractMeta';
import { parseFunctionMeta } from '../services/wizard/parseContractMeta';
import {
    estimateFee,
    deriveOutputStrategy,
    buildTxOutputs,
    effectiveRelayFeeSats,
    CHIPNET_MIN_RELAY_FEE_SATS,
    escrowSellerExactInputPath,
    type OutputStrategy,
} from '../services/wizard/txPlanning';
import { attachBurnerP2pkhSponsorIfNeeded } from '../services/chipnetLiveTest/exactInputValueMatchSponsor';
import { FundFromWalletConnectPanel } from './FundFromWalletConnectPanel';

/** Legacy vs token-aware Chipnet CashAddr encodings share the same locking bytecode — string compare false positive. */
function covenantCashAddrsEquivalent(a: string, b: string): boolean {
    const x = a.trim();
    const y = b.trim();
    if (x === y) return true;
    const ra = cashAddressToLockingBytecode(x);
    const rb = cashAddressToLockingBytecode(y);
    if (typeof ra === 'string' || typeof rb === 'string') return false;
    return binToHex(ra.bytecode) === binToHex(rb.bytecode);
}

/**
 * Contract inputs for spending: there is no multi-select UI yet, so an empty selection means “all synced UTXOs”.
 * (Previously only the single-UTXO case was auto-selected, which broke execute when several outputs existed.)
 */
function pickContractUtxosForSpend(contractUtxos: any[] | null | undefined, selectedUtxoIds: string[]): any[] {
    const list = contractUtxos ?? [];
    if (!list.length) return [];
    if (!selectedUtxoIds.length) return list;
    return list.filter((u) => selectedUtxoIds.includes(`${u.txid}:${u.vout}`));
}

interface TransactionBuilderProps {
    artifact: ContractArtifact;
    deployedAddress: string;
    constructorArgs: string[];
    wcSession: any;
    network?: string;
    initialUtxo?: any;
    onConfigChange?: (args: string[]) => void;
    project: Project;
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
    onRecordTransaction,
    project
}) => {
    const { wallets, activeWallet } = useWallet();
    const [selectedGlobalWalletId, setSelectedGlobalWalletId] = useState<string | null>(null);
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

    // Constructor Args State
    const [internalConstructorArgs, setInternalConstructorArgs] = useState<string[]>([]);

    // Parse ABI - SAFE ACCESS
    const functions = artifact?.abi.filter(item => item.type === 'function' || !item.type) || [];
    const constructorInputs = artifact?.constructorInputs || [];

    const cashContractSource = useMemo(
        () =>
            project.contractCode ??
            project.files.find((f) => f.name.endsWith('.cash'))?.content ??
            '',
        [project.contractCode, project.files]
    );

    const functionMetaByName = useMemo(() => parseFunctionMeta(cashContractSource), [cashContractSource]);

    const selectedFunctionMeta = useMemo((): FunctionMeta | null => {
        if (!selectedFunction) return null;
        return (
            functionMetaByName[selectedFunction] ?? {
                name: selectedFunction,
                role: 'quorum-spend',
                invariants: [],
            }
        );
    }, [functionMetaByName, selectedFunction]);

    const outputStrategyForSelection = useMemo((): OutputStrategy => {
        if (!selectedFunctionMeta) return { kind: 'unknown' };
        let s = deriveOutputStrategy(selectedFunctionMeta);
        const strings = (project.deploymentRecord?.constructorArgs ?? internalConstructorArgs).map((a) =>
            String(a ?? '')
        );
        if (s.kind === 'sweep-to-wallet' && escrowSellerExactInputPath(artifact, selectedFunction, strings)) {
            return { kind: 'exact-input-value-to-wallet' };
        }
        return s;
    }, [
        selectedFunctionMeta,
        artifact,
        selectedFunction,
        project.deploymentRecord?.constructorArgs,
        internalConstructorArgs,
    ]);

    /** HashTimeLock `refund()` uses CSV relative maturity; Chipnet interaction can sit idle for many minutes. */
    const isHtlcRefundSlowPath = useMemo(
        () =>
            project.deployedArtifact?.contractName === 'HashTimeLock' &&
            selectedFunction.toLowerCase() === 'refund',
        [project.deployedArtifact?.contractName, selectedFunction]
    );

    const txExecutionPreview = useMemo(() => {
        if (!selectedFunction || !contractUtxos?.length) return null;

        let selectedUtxos = pickContractUtxosForSpend(contractUtxos, selectedUtxoIds);
        if (selectedUtxos.length === 0) return null;

        const strings = (project.deploymentRecord?.constructorArgs ?? internalConstructorArgs).map((a) =>
            String(a ?? '')
        );
        if (escrowSellerExactInputPath(artifact, selectedFunction, strings) && selectedUtxoIds.length === 0) {
            selectedUtxos = [...selectedUtxos].sort((a, b) => b.value - a.value).slice(0, 1);
        }

        const meta: FunctionMeta =
            functionMetaByName[selectedFunction] ?? {
                name: selectedFunction,
                role: 'quorum-spend',
                invariants: [],
            };
        let strategy = deriveOutputStrategy(meta);
        if (
            strategy.kind === 'sweep-to-wallet' &&
            escrowSellerExactInputPath(artifact, selectedFunction, strings)
        ) {
            strategy = { kind: 'exact-input-value-to-wallet' };
        }
        const outputCount = 1;
        const fee = effectiveRelayFeeSats(strategy, selectedUtxos.length, outputCount, network);
        const totalInput = selectedUtxos.reduce((sum, u) => sum + BigInt(u.value), 0n);

        const globalWalletForAddr = wallets.find((w) => w.id === selectedGlobalWalletId);
        const walletCandidate =
            signingMethod === 'burner'
                ? globalWalletForAddr?.address || burnerAddress || ''
                : walletConnectService.getAddress() || '';

        const contractAddr = (deployedAddress || '').trim();

        let outputTo =
            walletCandidate && walletCandidate !== 'Not Connected' ? walletCandidate : contractAddr;

        if (
            artifact.contractName === 'ArbitrationEscrow' &&
            (selectedFunction === 'complete' || selectedFunction === 'arbitrateToSeller')
        ) {
            try {
                outputTo = arbitrationEscrowSellerPayoutAddress(artifact, strings);
            } catch {
                /* incomplete preview — execution will validate */
            }
        }

        try {
            const outputs = buildTxOutputs(strategy, totalInput, fee, outputTo, contractAddr || outputTo);
            return {
                meta,
                strategy,
                fee,
                totalInput,
                outputs,
                walletCandidate,
                contractAddr,
                error: null as string | null,
            };
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            return {
                meta,
                strategy,
                fee,
                totalInput,
                outputs: [] as Array<{ to: string; amount: bigint }>,
                walletCandidate,
                contractAddr,
                error: msg,
            };
        }
    }, [
        selectedFunction,
        contractUtxos,
        selectedUtxoIds,
        functionMetaByName,
        signingMethod,
        selectedGlobalWalletId,
        wallets,
        burnerAddress,
        deployedAddress,
        network,
        artifact,
        internalConstructorArgs,
        project.deploymentRecord?.constructorArgs,
    ]);

    /** Burner mode can still sign multiple roles in one tx — each sig slot uses the identity whose pubkey matches buyerPk/sellerPk/arbiterPk. */
    const multiPartySignerPreview = useMemo(() => {
        if (!selectedFunction || signingMethod !== 'burner') return null;
        const fn = functions.find((f: { name: string }) => f.name === selectedFunction);
        if (!fn?.inputs?.length) return null;
        const persisted = project.deploymentRecord?.constructorArgs;
        const args =
            persisted && persisted.length === constructorInputs.length ? persisted : internalConstructorArgs;
        const rows: { slot: string; party: string; walletName: string; matched: boolean }[] = [];
        for (const inp of fn.inputs as { name: string; type: string }[]) {
            if (inp.type !== 'sig') continue;
            const m = inp.name.match(/^(buyer|seller|arbiter)Sig$/i);
            if (!m) continue;
            const role = m[1].toLowerCase();
            const pkField = `${role}Pk`;
            const pkIdx = constructorInputs.findIndex((ci) => ci.name === pkField);
            const expectedPk = pkIdx >= 0 ? (args[pkIdx] ?? '').trim().toLowerCase() : '';
            const w = expectedPk ? wallets.find((x) => x.pubkey.trim().toLowerCase() === expectedPk) : undefined;
            rows.push({
                slot: inp.name,
                party: role,
                walletName: w?.name ?? 'No matching identity',
                matched: !!w,
            });
        }
        return rows.length > 0 ? rows : null;
    }, [
        selectedFunction,
        signingMethod,
        functions,
        internalConstructorArgs,
        project.deploymentRecord?.constructorArgs,
        constructorInputs,
        wallets,
    ]);

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

    const loadUtxos = useCallback(async (manual = false) => {
        if (!deployedAddress) return;
        setIsFetchingUtxos(true);
        let refreshToastSettled = !manual;
        if (manual) toast.loading('Refreshing balance...', { id: 'refresh_load' });
        try {
            const utxos = await fetchUTXOsWithTimeout(deployedAddress);
            setContractUtxos(utxos);

            const confirmedValue = utxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
            const unconfirmedValue = utxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

            setTotalBalance(confirmedValue + unconfirmedValue);
            setUnconfirmedContractBalance(unconfirmedValue);

            if (confirmedValue + unconfirmedValue > 0) setIsAwaitingPropagation(false);

            if (burnerAddress) {
                const bUtxos = await fetchUTXOsWithTimeout(burnerAddress);
                const bConfirmedValue = bUtxos.filter(u => u.height > 0).reduce((acc, u) => acc + u.value, 0);
                const bUnconfirmedValue = bUtxos.filter(u => u.height === 0).reduce((acc, u) => acc + u.value, 0);

                setBurnerBalance(bConfirmedValue + bUnconfirmedValue);
                setUnconfirmedBurnerBalance(bUnconfirmedValue);

                if (bConfirmedValue + bUnconfirmedValue > 0) setIsAwaitingPropagation(false);
            }
            if (manual) {
                const total = confirmedValue + unconfirmedValue;
                if (total > 0) {
                    toast.success(`Balance · ${total.toLocaleString()} sats`, { id: 'refresh_load' });
                } else {
                    toast(
                        'No balance detected yet. Funding may still be confirming or Chipnet Electrum is slow — try Refresh again.',
                        { id: 'refresh_load', duration: 5500 },
                    );
                }
                refreshToastSettled = true;
            }
        } catch (e) {
            console.error(e);
            if (manual) {
                const msg = e instanceof Error ? e.message : 'Failed to refresh balance';
                toast.error(msg, { id: 'refresh_load' });
                refreshToastSettled = true;
            }
        } finally {
            setIsFetchingUtxos(false);
            if (manual && !refreshToastSettled) toast.dismiss('refresh_load');
        }
    }, [deployedAddress, burnerAddress]);

    /** Explicit fetch on mount / address change — subscriptions alone miss errors (they previously swallowed RPC failures as empty). */
    useEffect(() => {
        if (!deployedAddress) return;
        void loadUtxos(false);
    }, [deployedAddress, burnerAddress, loadUtxos]);

    // Monitor addresses using subscriptions for live updates
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

    // Auto-select recommended wallet based on deployment record
    useEffect(() => {
        if (selectedFunction && project.deploymentRecord) {
            const isOwnerFunc = selectedFunction.toLowerCase().includes('release') || selectedFunction.toLowerCase().includes('owner');
            const isFunderFunc = selectedFunction.toLowerCase().includes('refund') || selectedFunction.toLowerCase().includes('funder');

            const recommendedId = isOwnerFunc ? project.deploymentRecord.ownerWalletId :
                isFunderFunc ? project.deploymentRecord.funderWalletId : null;

            if (recommendedId) {
                console.log(`[Interaction] Auto-selecting recommended wallet (${recommendedId}) for ${selectedFunction}`);
                setSelectedGlobalWalletId(recommendedId);
                setSigningMethod('burner'); // Treat global wallets as local 'burner' types for signing logic

                // NEW: Auto-fill function arguments if they are pubkey or address
                const wallet = wallets.find(w => w.id === recommendedId);
                if (wallet) {
                    setInputs(prev => prev.map(input => {
                        if (input.type === 'pubkey') return { ...input, value: wallet.pubkey };
                        if (input.type === 'address') return { ...input, value: wallet.address };
                        return input;
                    }));
                }
            } else if (activeWallet) {
                setSelectedGlobalWalletId(activeWallet.id);
            }
        }
    }, [selectedFunction, project.deploymentRecord, activeWallet, wallets]);

    // Secondary Auto-fill when manually switching wallets in builder
    useEffect(() => {
        if (selectedGlobalWalletId && signingMethod === 'burner') {
            const wallet = wallets.find(w => w.id === selectedGlobalWalletId);
            if (wallet) {
                setInputs(prev => prev.map(input => {
                    // Only auto-fill if the type matches and currently empty (or looks like another wallet's PK)
                    if (input.type === 'pubkey' && (!input.value || input.value.length === 66)) {
                        return { ...input, value: wallet.pubkey };
                    }
                    if (input.type === 'address' && (!input.value || input.value.length > 30)) {
                        return { ...input, value: wallet.address };
                    }
                    return input;
                }));
            }
        }
    }, [selectedGlobalWalletId, signingMethod, wallets]);

    useEffect(() => {
        if (isModalOpen && currentStep === 3 && deployedAddress) {
            void loadUtxos(false);
        }
    }, [isModalOpen, currentStep, deployedAddress, loadUtxos]);

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
    }, [isAwaitingPropagation, deployedAddress, burnerAddress, loadUtxos]);

    /**
     * Reusable Faucet function
     */
    const handleAutoFund = async (targetAddress: string) => {
        if (!targetAddress) return;
        setIsFundingBurner(true);
        try {
            const result = await requestFaucetFunds(targetAddress);

            if (result.success) {
                if (result.txid) {
                    toast.success('Testnet gas secured! TX: ' + result.txid.slice(0, 10) + '...', { id: 'fund_success' });
                } else {
                    toast.success('Funds requested. Awaiting network confirmation.', { id: 'fund_req' });
                }
                // Trigger propagation UI (Subscription & Polling will handle the update)
                setIsAwaitingPropagation(true);
                // Immediately check once
                loadUtxos();
            } else {
                toast.error(result.error || 'Funding failed', { id: 'fund_err' });
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
            const rawBridgeFee = estimateFee(1, 1);
            const fee =
                network === 'chipnet' && rawBridgeFee < CHIPNET_MIN_RELAY_FEE_SATS ?
                    CHIPNET_MIN_RELAY_FEE_SATS
                :   rawBridgeFee;
            const amount = BigInt(burnerBalance || 0) - fee;

            if (amount <= 500n) {
                toast.error('Insufficient burner funds (need balance above Chipnet relay fee + dust).', { id: 'bridge_load' });
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

        const hasBurnerSigner = !!(wallets.find(w => w.id === selectedGlobalWalletId)?.wif || burnerWif);
        if (signingMethod === 'burner' && !hasBurnerSigner) {
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
            const {
                Contract,
                ElectrumNetworkProvider,
                SignatureTemplate,
                HashType,
                SignatureAlgorithm,
                Network: CashScriptNetwork,
                TransactionBuilder: CashScriptTransactionBuilder,
                placeholderSignature,
            } = await import('cashscript');

            const deploymentArgs = project.deploymentRecord?.constructorArgs;
            const sanitizedConstructorArgs = (deploymentArgs || internalConstructorArgs).map((arg) => arg || '');

            const source =
                project.contractCode ??
                project.files.find((f) => f.name.endsWith('.cash'))?.content ??
                '';
            const allMeta = parseFunctionMeta(source);
            const fnMeta: FunctionMeta =
                allMeta[selectedFunction] ?? {
                    name: selectedFunction,
                    role: 'quorum-spend',
                    invariants: [],
                };
            let outputStrategy = deriveOutputStrategy(fnMeta);
            if (
                outputStrategy.kind === 'sweep-to-wallet' &&
                escrowSellerExactInputPath(artifact, selectedFunction, sanitizedConstructorArgs)
            ) {
                outputStrategy = { kind: 'exact-input-value-to-wallet' };
            }

            const activeHost =
                getElectrumConnectionSnapshot().host ?? ELECTRUM_FALLBACK_SERVERS[0];
            const provider = new ElectrumNetworkProvider(CashScriptNetwork.CHIPNET, {
                hostname: activeHost,
            });
            console.log(`Provider initialized with Electrum host: ${activeHost}`);

            // 2. Initialize Contract (sanitizedConstructorArgs already aligned with deployment record)
            const typedConstructorArgs = coerceConstructorArgs(artifact.constructorInputs, sanitizedConstructorArgs);
            const contract = new Contract(artifact as any, typedConstructorArgs, { provider }) as any;

            // CRITICAL DEBUGGING: Verify contract initialization matches deployment
            console.log('[Debug] Initializing contract for execution...');
            console.log('[Debug] Source of Args:             ', deploymentArgs ? 'Deployment Record (Persisted)' : 'Internal State (Live)');
            console.log('[Debug] Expected Address (Project):', deployedAddress);
            console.log('[Debug] Generated Address (Local):  ', contract.address);
            console.log('[Debug] Constructor Args Used:      ', sanitizedConstructorArgs);

            const candidateAddrs = [contract.address, (contract as { tokenAddress?: string }).tokenAddress].filter(
                (addr): addr is string => typeof addr === 'string' && addr.trim().length > 0
            );
            const addrMatchesDeployment =
                !deployedAddress ||
                candidateAddrs.some((addr) => covenantCashAddrsEquivalent(deployedAddress, addr));

            if (!addrMatchesDeployment) {
                const errorMsg = `Identity Drift Detected: The contract address generated from your current configuration (${candidateAddrs.join(' / ')}) does not match the deployed address (${deployedAddress}). This usually means your identity keys or constructor args have changed since deployment. Script verification will likely fail.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
            console.log('Contract initialized:', contract);
            console.log('Available functions:', contract.functions); // Debugging line

            // 3. Prepare Arguments
            const func = functions.find(f => f.name === selectedFunction);
            if (!func) throw new Error("Function not found");

            const createSigTemplate = (sigAbiName: string) => {
                const roleMatch = sigAbiName.match(/^(buyer|seller|arbiter)Sig$/i);
                let wifToUse: string | undefined;
                if (roleMatch) {
                    const role = roleMatch[1].toLowerCase();
                    const pkField = `${role}Pk`;
                    const pkIdx = artifact.constructorInputs.findIndex((ci: { name: string }) => ci.name === pkField);
                    const expectedPk =
                        pkIdx >= 0 ? (sanitizedConstructorArgs[pkIdx] ?? '').trim().toLowerCase() : '';
                    const matchedWallet = expectedPk
                        ? wallets.find((w) => w.pubkey.trim().toLowerCase() === expectedPk)
                        : undefined;
                    if (expectedPk && !matchedWallet) {
                        throw new Error(
                            `No NexOps test identity has the ${role} private key (${pkField}). Add an identity whose pubkey matches the constructor, or import that WIF — ${sigAbiName} must be signed by ${role}.`
                        );
                    }
                    if (matchedWallet) {
                        wifToUse = matchedWallet.wif;
                    }
                }
                if (!wifToUse) {
                    const globalWallet = wallets.find((w) => w.id === selectedGlobalWalletId);
                    wifToUse = globalWallet?.wif || burnerWif;
                }
                if (!wifToUse) throw new Error("No private key found for signing. Please generate or select a wallet.");
                return new SignatureTemplate(wifToUse, HashType.SIGHASH_ALL, SignatureAlgorithm.ECDSA);
            };

            const typedArgs = await Promise.all(inputs.map(async (input, i) => {
                const def = func.inputs[i];

                // Handle Signature Placeholders
                if (def.type === 'sig') {
                    if (signingMethod === 'walletconnect') {
                        return placeholderSignature();
                    }
                    return createSigTemplate(def.name);
                }

                if (def.type === 'int') {
                    const val = input.value || '0';
                    if (isNaN(Number(val))) throw new Error(`Invalid integer for ${input.name}`);
                    return BigInt(val);
                }
                if (def.type === 'bool') return input.value === 'true';
                if (def.type === 'bytes') return cashscriptBytesFromString(input.value || '');

                return input.value;
            }));

            console.log("Building transaction with args:", typedArgs);

            // 4. Build Transaction Builder
            // Breaking Change Fix: CashScript v0.10+ uses 'unlock' instead of 'functions'
            // to conform to the new mental model (we are unlocking UTXOs).
            // However, the object is still dynamically keyed by function name.

            // 4. Build Transaction (CashScript v0.10+ Flow)
            console.log("Preparing UTXOs from selected set...");

            let selectedUtxos = pickContractUtxosForSpend(contractUtxos, selectedUtxoIds);

            if (selectedUtxos.length === 0) {
                throw new Error("No UTXOs found for this contract. Please fund it first.");
            }

            if (escrowSellerExactInputPath(artifact, selectedFunction, sanitizedConstructorArgs)) {
                if (selectedUtxos.length !== 1) {
                    if (selectedUtxoIds.length > 0) {
                        throw new Error(
                            'Escrow with release cap 0 requires exactly one contract UTXO per transaction. Clear custom selection or pick a single output in Advanced.'
                        );
                    }
                    selectedUtxos = [...selectedUtxos].sort((a, b) => b.value - a.value).slice(0, 1);
                    toast.success(
                        `Escrow release cap 0: one contract input per tx — using ${selectedUtxos[0].value} sats. Run again for other outputs.`,
                        { duration: 6500 }
                    );
                }
            }

            console.log(`Using ${selectedUtxos.length} selected UTXOs for transaction.`);

            const txBuilder = new CashScriptTransactionBuilder({ provider });

            const unlocker = contract.unlock[selectedFunction](...typedArgs);

            selectedUtxos.forEach((utxo) => {
                txBuilder.addInput(
                    {
                        txid: utxo.txid,
                        vout: utxo.vout,
                        satoshis: BigInt(utxo.value),
                    },
                    unlocker
                );
            });

            const totalInput = selectedUtxos.reduce((sum, u) => sum + BigInt(u.value), 0n);
            const outputCount = 1;
            const fee = effectiveRelayFeeSats(outputStrategy, selectedUtxos.length, outputCount, network);

            const globalWalletForAddr = wallets.find((w) => w.id === selectedGlobalWalletId);
            const walletAddress =
                signingMethod === 'burner' ? globalWalletForAddr?.address || burnerAddress : getWalletAddress();

            let sweepDestination =
                walletAddress && walletAddress !== 'Not Connected' ? walletAddress : contract.address;

            if (
                artifact.contractName === 'ArbitrationEscrow' &&
                (selectedFunction === 'complete' || selectedFunction === 'arbitrateToSeller')
            ) {
                try {
                    sweepDestination = arbitrationEscrowSellerPayoutAddress(artifact, sanitizedConstructorArgs);
                } catch (e) {
                    console.warn('[TransactionBuilder] seller payout address', e);
                    throw new Error(
                        'Could not derive seller payout from sellerLockingBytecode (need standard P2PKH hex 76a914…88ac).'
                    );
                }
            }

            const sponsorWif = globalWalletForAddr?.wif || burnerWif;
            const sponsorAddr = globalWalletForAddr?.address || burnerAddress;

            const outputs = buildTxOutputs(
                outputStrategy,
                totalInput,
                fee,
                sweepDestination,
                contract.address
            );

            if (
                outputStrategy.kind === 'exact-input-value-to-wallet' &&
                escrowSellerExactInputPath(artifact, selectedFunction, sanitizedConstructorArgs)
            ) {
                if (!sponsorWif || !sponsorAddr) {
                    throw new Error(
                        'This escrow call pays the seller the full UTXO with no fee taken from that output (covenant rule). NexOps adds a separate Chipnet P2PKH input to pay miners — use Test Wallet with a funded identity (WIF), same pattern as the CLI.'
                    );
                }
                await attachBurnerP2pkhSponsorIfNeeded({
                    outputStrategy,
                    txBuilder,
                    provider,
                    wif: sponsorWif,
                    burnerAddress: sponsorAddr,
                    sponsorSizing: {
                        covenantInputCount: selectedUtxos.length,
                        covenantOutputCount: outputs.length,
                    },
                });
            }

            outputs.forEach((o) => txBuilder.addOutput({ to: o.to, amount: o.amount }));

            // 6. Build Unsigned/Signed Transaction
            let signedHex: string;

            if (signingMethod === 'burner') {
                console.log("Signing locally with burner WIF...");
                const tx = await txBuilder.build();
                // cashscript build() returns the hex if all signatures are satisfied
                signedHex = typeof tx === 'string' ? tx : (tx as any).hex;
                console.log("Signed Hex (Local):", signedHex);
            } else {
                console.log('Generating WalletConnect transaction object (CashScript wc2-bch-bcr)...');
                const wcObj = txBuilder.generateWcTransactionObject({
                    broadcast: false,
                    userPrompt: 'Sign NexOps smart contract transaction',
                });
                signedHex = await walletConnectService.requestSignature(wcObj);
                console.log('Signed Hex (Post-Sign):', signedHex);
            }

            // 8. Broadcast
            console.log("Selected UTXOs:", selectedUtxos);
            console.log("Network:", network);
            console.log("Provider network:", (provider as any).network);
            console.log('Broadcasting...');
            console.log('[nexops:tx-plan]', {
                fnMeta,
                outputStrategy,
                outputs,
                fee,
                totalInput,
                activeHost,
            });
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
                                    <Wallet className="w-4 h-4 mr-2 text-nexus-pink shrink-0" />
                                    <span>
                                        {multiPartySignerPreview && /^(buyer|seller|arbiter)Sig$/i.test(input.name)
                                            ? 'Signed locally by the test identity whose pubkey matches this role (same run can use several identities).'
                                            : signingMethod === 'walletconnect'
                                              ? 'Will be signed via WalletConnect'
                                              : 'Will be signed by the selected test wallet'}
                                    </span>
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

            {selectedFunctionMeta && (
                <div
                    className={`rounded-xl border p-4 space-y-2 ${
                        outputStrategyForSelection.kind === 'token-mint'
                            ? 'border-yellow-500/30 bg-yellow-500/5'
                            : outputStrategyForSelection.kind === 'unknown'
                              ? 'border-white/10 bg-black/20'
                              : 'border-nexus-cyan/20 bg-nexus-cyan/5'
                    }`}
                >
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Output plan
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">
                        {outputStrategyForSelection.kind === 'sweep-to-wallet' &&
                            'All funds minus fee go to your wallet.'}
                        {outputStrategyForSelection.kind === 'exact-input-value-to-wallet' &&
                            'Single output must equal locked contract input value (no fee deducted — multisig-style covenant).'}
                        {outputStrategyForSelection.kind === 'value-preserving-to-self' &&
                            'Funds loop back to the contract (value-preserving covenant).'}
                        {outputStrategyForSelection.kind === 'bound-payout' &&
                            'Recipient is locked by the contract.'}
                        {outputStrategyForSelection.kind === 'token-mint' &&
                            'Token-mint: manual outputs required (not yet supported).'}
                        {outputStrategyForSelection.kind === 'unknown' &&
                            'Output strategy could not be determined from contract metadata; execution uses the default single-output path.'}
                    </p>
                </div>
            )}

            {isHtlcRefundSlowPath && (
                <div className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                    <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                        <span className="font-bold uppercase tracking-wide text-amber-400">Refund timing — </span>
                        This path waits for your funding tx to confirm, then for the relative timeout in blocks before the
                        transaction can relay. On Chipnet that often means several minutes (sometimes longer); keep this
                        panel open until broadcast completes.
                    </p>
                </div>
            )}

            <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep(1)} icon={<ArrowLeft className="w-4 h-4" />}>
                    Back
                </Button>
                <div>
                    {selectedFunction && project.deploymentRecord && (
                        (() => {
                            const isOwnerFunc = selectedFunction.toLowerCase().includes('release') || selectedFunction.toLowerCase().includes('owner');
                            const isFunderFunc = selectedFunction.toLowerCase().includes('refund') || selectedFunction.toLowerCase().includes('funder');

                            const requiredId = isOwnerFunc ? project.deploymentRecord.ownerWalletId :
                                isFunderFunc ? project.deploymentRecord.funderWalletId : null;

                            const isMismatch = requiredId && activeWallet?.id !== requiredId;

                            if (isMismatch) {
                                return (
                                    <div className="inline-flex items-center space-x-2 px-3 py-1 bg-nexus-pink/10 border border-nexus-pink/20 rounded-lg text-[10px] text-nexus-pink font-bold mr-4 animate-pulse">
                                        <ShieldAlert size={12} />
                                        <span>Identity Mismatch: {isOwnerFunc ? 'Owner' : 'Funder'} Role</span>
                                    </div>
                                );
                            }
                            return null;
                        })()
                    )}
                    <Button onClick={() => setCurrentStep(3)} icon={<ArrowRight className="w-4 h-4" />}>
                        Next: Preview
                    </Button>
                </div>
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
        const hasBurnerSigner = !!(wallets.find(w => w.id === selectedGlobalWalletId)?.wif || burnerWif);

        const networkPrefix = (network === 'mainnet' || network === 'main') ? 'bitcoincash:' : 'bchtest:';

        const getQrValue = (addr: string) => {
            if (!addr) return '';
            return addr.includes(':') ? addr : `${networkPrefix}${addr}`;
        };

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* BETA DISCLAIMER */}
                <div className="flex items-start gap-2.5 px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-yellow-300/80 leading-relaxed">
                        <span className="font-black uppercase tracking-wider text-yellow-400">Execution note — </span>
                        WalletConnect uses BCH WalletConnect (wc2-bch-bcr); Paytaca, Cashonize, Zapit, and similar wallets show a readable contract screen before signing. Novel covenant paths may still fail until tested — multi-party escrow with separate keys is often smoother with Burner identities and test wallets.
                    </p>
                </div>
                {isHtlcRefundSlowPath && (
                    <div className="flex gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                        <Clock className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                        <p className="text-[11px] text-amber-100/90 leading-relaxed">
                            HashTimeLock refund uses a relative block delay after the contract UTXO confirms. Execution may
                            appear idle while the network advances; this is expected before the spend broadcasts.
                        </p>
                    </div>
                )}
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

                        <FundFromWalletConnectPanel
                            contractAddress={deployedAddress || ''}
                            disabled={!deployedAddress}
                            onFunded={() => void loadUtxos(false)}
                        />

                        {/* Auto-Fund button removed at user request */}
                    </div>
                )}

                {/* FUNCTION DETAILS */}
                <div className="bg-black/20 border border-white/5 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Target Function</span>
                        <Badge variant="info" className="flex items-center gap-1 bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20 font-mono py-1 px-3">
                            {selectedFunction}()
                        </Badge>
                    </div>

                    {constructorInputs.length > 0 && (
                        <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Configuration</span>
                            <div className="grid grid-cols-1 gap-2">
                                {constructorInputs.map((input, idx) => {
                                    const deploymentArgs = project.deploymentRecord?.constructorArgs;
                                    const valueToDisplay = deploymentArgs ? deploymentArgs[idx] : internalConstructorArgs[idx];
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-nexus-cyan/5 border border-nexus-cyan/10 rounded-lg">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-gray-500 font-bold uppercase">{input.name}</span>
                                                <span className="text-[9px] text-nexus-cyan/60 font-mono truncate max-w-[150px]">{valueToDisplay}</span>
                                            </div>
                                            <Badge variant="info" className="text-[8px] opacity-40 border-white/10 uppercase tracking-tighter">
                                                {deploymentArgs ? 'Immutable' : 'Read Only'}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Estimated outputs (from wizard metadata + selected UTXOs) */}
                {txExecutionPreview && (
                    <div className="bg-nexus-900/40 border border-white/10 rounded-2xl p-5 space-y-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            Estimated outputs
                        </span>
                        {txExecutionPreview.error ? (
                            <p className="text-xs text-amber-400/90 leading-relaxed">{txExecutionPreview.error}</p>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {txExecutionPreview.outputs.map((o, i) => (
                                        <div
                                            key={i}
                                            className="flex flex-col gap-1 p-3 bg-black/30 rounded-lg border border-white/5"
                                        >
                                            <span className="text-[9px] text-gray-500 font-bold uppercase">
                                                Output {i + 1}
                                            </span>
                                            <span className="font-mono text-[10px] text-nexus-cyan break-all">
                                                {o.to}
                                            </span>
                                            <span className="text-[11px] text-white font-mono">
                                                {o.amount.toString()} sats
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-white/5">
                                    <span>Fee (estimate)</span>
                                    <span>{txExecutionPreview.fee.toString()} sats</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-gray-400">
                                    <span>Total input</span>
                                    <span>{txExecutionPreview.totalInput.toString()} sats</span>
                                </div>
                            </>
                        )}
                    </div>
                )}

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
                                    <div className="text-[9px] text-nexus-cyan/40 font-bold italic">Auto-Syncing</div>
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
                                <div className="flex justify-between items-center mb-2">
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

                                {signingMethod === 'burner' ? (
                                    <p className="text-[9px] text-gray-500 mb-3 leading-relaxed">
                                        {multiPartySignerPreview ?
                                            'One execution can still produce multiple signatures locally: each buyer/seller/arbiter slot uses whichever test identity owns that pubkey. The dropdown only chooses the default wallet for single-sig functions.'
                                        :   'The selected test wallet signs slots that are not bound to named buyer/seller/arbiter roles.'}
                                    </p>
                                ) : null}

                                <div className="flex items-center justify-between bg-black/20 p-3 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${signingMethod === 'burner' ? 'bg-nexus-cyan/20 text-nexus-cyan' : 'bg-blue-500/10 text-blue-500'}`}>
                                            <Wallet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-white font-bold leading-none">
                                                {signingMethod === 'burner'
                                                    ? (wallets.find(w => w.id === selectedGlobalWalletId)?.name || 'Local Wallet')
                                                    : (wcSession?.peer?.metadata?.name || 'WalletConnect')}
                                            </p>
                                            <p className="text-[9px] font-mono text-gray-500 mt-1">
                                                {signingMethod === 'burner'
                                                    ? (() => {
                                                        const addr = wallets.find(w => w.id === selectedGlobalWalletId)?.address || burnerAddress;
                                                        return addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : 'Not Generated';
                                                    })()
                                                    : (walletConnectService.getAddress() ? `${walletConnectService.getAddress()?.slice(0, 10)}...${walletConnectService.getAddress()?.slice(-8)}` : 'Not Connected')}
                                            </p>
                                        </div>
                                    </div>
                                    {signingMethod === 'burner' && (
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={selectedGlobalWalletId || ''}
                                                onChange={(e) => setSelectedGlobalWalletId(e.target.value)}
                                                className="bg-black/40 text-[9px] text-nexus-cyan font-bold border border-white/10 rounded px-2 py-1 outline-none focus:border-nexus-cyan/40"
                                            >
                                                {wallets.map(w => (
                                                    <option key={w.id} value={w.id}>{w.name}</option>
                                                ))}
                                                <option value="" disabled>Other...</option>
                                            </select>
                                            {!burnerWif && wallets.length === 0 && (
                                                <button
                                                    onClick={onGenerateBurner}
                                                    className="text-[9px] font-black text-nexus-cyan hover:underline uppercase tracking-widest"
                                                >
                                                    Generate
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {signingMethod === 'burner' && multiPartySignerPreview ? (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 space-y-2">
                                        <div className="text-[9px] font-black uppercase tracking-wider text-gray-500">
                                            Signers for {selectedFunction}()
                                        </div>
                                        <ul className="space-y-1.5">
                                            {multiPartySignerPreview.map((row) => (
                                                <li
                                                    key={row.slot}
                                                    className="flex flex-wrap items-center justify-between gap-2 text-[9px] font-mono"
                                                >
                                                    <span className="text-gray-400">{row.slot}</span>
                                                    <span className={row.matched ? 'text-emerald-400' : 'text-amber-400'}>
                                                        {row.walletName}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        {!multiPartySignerPreview.every((r) => r.matched) ? (
                                            <p className="text-[9px] text-amber-300/90 leading-snug border-t border-white/5 pt-2 mt-1">
                                                Add test identities whose pubkeys match buyer/seller/arbiter (wizard &quot;Fill party pubkeys&quot; / Create 3 identities).
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>

                {/* BOTTOM ROW: Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-4">
                    <Button variant="ghost" onClick={() => setCurrentStep(2)}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Args
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            onClick={() => {
                                handleExecute();
                                setCurrentStep(4);
                            }}
                            disabled={signingMethod === 'walletconnect' ? !isConnected : !hasBurnerSigner}
                            variant={(signingMethod === 'walletconnect' ? isConnected : hasBurnerSigner) ? 'primary' : 'secondary'}
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
                            variant="ghost"
                            onClick={() =>
                                executionResult.txid &&
                                window.open(getExplorerLink(executionResult.txid), '_blank')
                            }
                            disabled={!executionResult.txid}
                        >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Transaction
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
    if (!artifact) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <div className="text-xs uppercase tracking-widest font-black">Missing Artifact</div>
                <p className="text-[10px] mt-2 opacity-60">The contract metadata is missing. Try re-compiling the contract.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/5 bg-black/20">
                <div className="flex justify-between items-center mb-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center">
                        <Terminal className="w-3 h-3 mr-2 text-nexus-cyan" />
                        Available Actions
                    </h3>
                    {totalBalance > 0 ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadUtxos(true)}
                                disabled={isFetchingUtxos}
                                className={`p-1.5 rounded-lg border border-nexus-cyan/20 hover:bg-nexus-cyan/10 transition-colors ${isFetchingUtxos ? 'animate-pulse' : ''}`}
                                title="Refresh Balance"
                            >
                                <RotateCcw className={`w-3 h-3 text-nexus-cyan ${isFetchingUtxos ? 'animate-spin' : ''}`} />
                            </button>
                            <Badge variant="success" className="text-[9px] py-0 h-4 shadow-[0_0_10px_rgba(34,197,94,0.3)]">Funded: {totalBalance.toLocaleString()} sats</Badge>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadUtxos(true)}
                                disabled={isFetchingUtxos}
                                className={`p-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors ${isFetchingUtxos ? 'animate-pulse' : ''}`}
                                title="Refresh Balance"
                            >
                                <RotateCcw className={`w-3 h-3 text-slate-500 ${isFetchingUtxos ? 'animate-spin' : ''}`} />
                            </button>
                            <Badge variant="medium" className="px-1 py-0 h-4 min-w-[32px] justify-center">UNFUNDED</Badge>
                        </div>
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
                <Badge variant="info" className="text-[10px] opacity-50 uppercase font-black">{history.length} SPENDS</Badge>
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
