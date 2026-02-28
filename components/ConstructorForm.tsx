import React, { useState, useEffect } from 'react';
import { HelpCircle, AlertCircle, AlertTriangle, CheckCircle, Info, Wallet, Loader2, Play, Activity, Zap, RefreshCw, User, ChevronDown } from 'lucide-react';
import { ContractArtifact } from '../types';
import { validateConstructorArg, ValidationResult } from '../services/validationService';
import { walletConnectService } from '../services/walletConnectService';
import { useWallet } from '../contexts/WalletContext';
import { Button } from './UI';
import toast from 'react-hot-toast';

interface ConstructionProps {
    inputs: ContractArtifact['constructorInputs'];
    values?: string[]; // Added prop for persistence
    onChange: (args: string[], validations: Record<string, ValidationResult>) => void;
    burnerWif?: string;
    burnerAddress?: string;
    burnerPubkey?: string;
    onGenerateBurner?: () => void;
    isGeneratingBurner?: boolean;
}

// Micro-explanations for common input types
const getInputExplanation = (name: string, type: string): string => {
    if (type === 'pubkey') {
        return `This public key controls ${name}. Must be a compressed secp256k1 key (33 bytes, starts with 02/03). Changing it creates a different contract address.`;
    }
    if (type.startsWith('int')) {
        return `Integer value for ${name}. This affects the contract's behavior and address derivation.`;
    }
    if (type === 'bytes' || type === 'string') {
        return `Data value for ${name}. This will be encoded into the contract's locking script.`;
    }
    return `Parameter ${name} of type ${type}. This value affects the contract address.`;
};

export const ConstructorForm: React.FC<ConstructionProps> = ({
    inputs,
    values,
    onChange,
    burnerWif,
    burnerAddress,
    burnerPubkey,
    onGenerateBurner,
    isGeneratingBurner = false
}) => {
    // Initialize from values prop if available
    const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        if (values) {
            inputs.forEach((inp, i) => {
                initial[inp.name] = values[i] || '';
            });
        }
        return initial;
    });

    const [fieldValidations, setFieldValidations] = useState<Record<string, ValidationResult>>({});
    const [showTooltip, setShowTooltip] = useState<string | null>(null);
    const { wallets, activeWallet } = useWallet();

    // Sync state if external values change (e.g. edited in one view and switched to another)
    React.useEffect(() => {
        if (values) {
            setFieldValues((prev) => {
                const next = { ...prev };
                let changed = false;
                inputs.forEach((inp, i) => {
                    const val = values[i] || '';
                    if (next[inp.name] !== val) {
                        next[inp.name] = val;
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }
    }, [values, inputs]);

    // Manual Apply Handler
    const handleApply = () => {
        const orderedArgs = inputs.map(inp => fieldValues[inp.name] || '');
        onChange(orderedArgs, fieldValidations);
    };

    // AUTO-FILL PUBKEY LOGIC
    useEffect(() => {
        if (inputs.length === 0) return;

        let updated = false;
        const nextValues = { ...fieldValues };
        const nextValidations = { ...fieldValidations };

        inputs.forEach((input, i) => {
            if (input.type === 'pubkey') {
                let pkValue = '';

                // Priority 1: Burner
                if (burnerPubkey) {
                    pkValue = burnerPubkey;
                }
                // Priority 2: WalletConnect
                else if (walletConnectService.isConnected()) {
                    pkValue = walletConnectService.getPublicKey();
                }

                // REFINE: Only auto-fill if the target field is EMPTY
                // This prevents the automatic logic from overriding a manual user choice 
                // while still providing a sensible default.
                const currentValue = nextValues[input.name];
                if (pkValue && !currentValue && currentValue !== pkValue) {
                    nextValues[input.name] = pkValue;
                    nextValidations[input.name] = validateConstructorArg(pkValue, 'pubkey', input.name);
                    updated = true;
                }
            }
        });

        if (updated) {
            setFieldValues(nextValues);
            setFieldValidations(nextValidations);

            // Map back to array for onChange
            const args = inputs.map(inp => nextValues[inp.name] || '');
            onChange(args, nextValidations);
        }
    }, [burnerPubkey, inputs, burnerAddress]); // Re-run when burner changes or wallet connects

    // MANUAL PUBKEY AUTOFILL
    const autoFillFromSource = (source: 'burner' | 'walletconnect') => {
        let pkValue = '';
        if (source === 'burner' && burnerPubkey) {
            pkValue = burnerPubkey;
        } else if (source === 'walletconnect' && walletConnectService.isConnected()) {
            pkValue = walletConnectService.getPublicKey();
        }

        if (!pkValue) {
            if (source === 'walletconnect') {
                toast.error("Wallet did not provide a public key in the session. You may need to enter it manually.", { id: 'wc-pk-error' });
            }
            return;
        }

        let updated = false;
        const nextValues = { ...fieldValues };
        const nextValidations = { ...fieldValidations };

        inputs.forEach((input) => {
            if (input.type === 'pubkey') {
                if (nextValues[input.name] !== pkValue) {
                    nextValues[input.name] = pkValue;
                    nextValidations[input.name] = validateConstructorArg(pkValue, 'pubkey', input.name);
                    updated = true;
                }
            }
        });

        if (updated) {
            setFieldValues(nextValues);
            setFieldValidations(nextValidations);
            const args = inputs.map(inp => nextValues[inp.name] || '');
            onChange(args, nextValidations);
        }
    };

    const handleFieldChange = (name: string, value: string, type: string) => {
        const newValidation = value ? validateConstructorArg(value, type, name) : { isValid: true, severity: 'info', message: '' };

        setFieldValues(prev => ({ ...prev, [name]: value }));
        setFieldValidations(prev => ({ ...prev, [name]: newValidation as ValidationResult }));

        // Propagate immediately
        const nextValues = { ...fieldValues, [name]: value };
        const nextValidations = { ...fieldValidations, [name]: newValidation as ValidationResult };
        const args = inputs.map(inp => nextValues[inp.name] || '');
        onChange(args, nextValidations);
    };

    if (inputs.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Global Identity Selection (Quick Set) */}
            {wallets.length > 0 && (
                <div className="p-3 bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-xl mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <Wallet size={14} className="text-nexus-cyan" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Identity Selection</span>
                        </div>
                        <div className="flex items-center space-x-1">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{wallets.length} Identities Available</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {wallets.map(w => (
                            <button
                                key={w.id}
                                onClick={() => {
                                    // Try to find the first empty pubkey field and fill it
                                    const firstEmptyPk = inputs.find(inp => inp.type === 'pubkey' && !fieldValues[inp.name]);
                                    if (firstEmptyPk) {
                                        handleFieldChange(firstEmptyPk.name, w.pubkey, 'pubkey');
                                        toast.success(`Assigned ${w.name} to ${firstEmptyPk.name}`);
                                    } else {
                                        // If none empty, toast instructions
                                        toast.error("No empty public key fields. Use per-field selector.");
                                    }
                                }}
                                className="px-3 py-1.5 bg-black/40 border border-white/10 hover:border-nexus-cyan/50 rounded-lg text-[10px] font-bold text-slate-300 transition-all flex items-center space-x-2 hover:text-white"
                            >
                                <User size={12} className="text-nexus-cyan" />
                                <span>{w.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {inputs.map((inp, idx) => {
                    const validation = fieldValidations[inp.name];
                    const hasValue = !!fieldValues[inp.name];

                    // Determine border color based on validation
                    let borderColor = 'border-gray-700';
                    if (hasValue && validation) {
                        if (validation.severity === 'error') borderColor = 'border-red-500';
                        else if (validation.severity === 'warning') borderColor = 'border-yellow-500';
                        else if (validation.isValid) borderColor = 'border-green-500';
                    }

                    return (
                        <div key={idx}>
                            <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                                <div className="flex items-center">
                                    <span>{inp.name}</span>
                                    <button
                                        type="button"
                                        onMouseEnter={() => setShowTooltip(inp.name)}
                                        onMouseLeave={() => setShowTooltip(null)}
                                        className="ml-1.5 text-gray-400 hover:text-nexus-cyan transition-colors"
                                    >
                                        <Info className="w-3 h-3" />
                                    </button>
                                </div>
                                <span className="text-cyan-500">{inp.type}</span>
                            </div>

                            {/* Tooltip */}
                            {showTooltip === inp.name && (
                                <div className="mb-2 p-2 bg-nexus-cyan/10 border border-nexus-cyan/30 rounded text-[10px] text-gray-300 leading-relaxed">
                                    {getInputExplanation(inp.name, inp.type)}
                                </div>
                            )}

                            <div className="relative group/input flex gap-2">
                                <input
                                    value={fieldValues[inp.name] || ''}
                                    onChange={(e) => handleFieldChange(inp.name, e.target.value, inp.type)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                                    className={`flex-1 bg-black/50 border ${borderColor} rounded px-2 py-1.5 text-xs font-mono text-gray-300 focus:border-cyan-500 outline-none transition-colors pr-24`}
                                    placeholder={`Value for ${inp.name}`}
                                />
                                {(inp.type === 'pubkey' || inp.type === 'address') && wallets.length > 0 && (
                                    <div className="relative">
                                        <select
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            onChange={(e) => {
                                                const w = wallets.find(wall => wall.id === e.target.value);
                                                if (w) {
                                                    const val = inp.type === 'pubkey' ? w.pubkey : w.address;
                                                    handleFieldChange(inp.name, val, inp.type);
                                                }
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>Select Wallet</option>
                                            {wallets.map(w => (
                                                <option key={w.id} value={w.id}>{w.name}</option>
                                            ))}
                                        </select>
                                        <div className="h-full px-2 bg-nexus-cyan/10 border border-nexus-cyan/20 rounded flex items-center space-x-1 text-nexus-cyan hover:bg-nexus-cyan/20 transition-colors">
                                            <User size={12} />
                                            <ChevronDown size={10} />
                                        </div>
                                    </div>
                                )}
                                {inp.type === 'pubkey' && walletConnectService.isConnected() && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                const pubkey = await walletConnectService.derivePublicKeyFromWallet();
                                                handleFieldChange(inp.name, pubkey, 'pubkey');
                                                toast.success("Public key auto-filled from wallet");
                                            } catch (e) {
                                                console.error("Auto-derivation failed:", e);
                                                toast.error("Auto-derivation failed. Please paste manually.", { id: 'derivation-error' });
                                            }
                                        }}
                                        className="absolute right-1 top-1 bottom-1 px-2 bg-nexus-cyan/10 hover:bg-nexus-cyan/20 border border-nexus-cyan/20 rounded text-[8px] font-black uppercase text-nexus-cyan transition-all active:scale-95"
                                    >
                                        Web3
                                    </button>
                                )}
                            </div>
                            {hasValue && validation && validation.message && (
                                <div className={`flex items-center mt-1 text-[10px] ${validation.severity === 'error' ? 'text-red-400' :
                                    validation.severity === 'warning' ? 'text-yellow-400' :
                                        'text-green-400'
                                    }`}>
                                    {validation.severity === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                                    {validation.severity === 'warning' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                    {validation.severity === 'info' && validation.isValid && <CheckCircle className="w-3 h-3 mr-1" />}
                                    {validation.message}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
