import React, { useState, useEffect } from 'react';
import { HelpCircle, AlertCircle, AlertTriangle, CheckCircle, Info, Wallet, Loader2, Play, Activity, Zap, RefreshCw } from 'lucide-react';
import { ContractArtifact } from '../types';
import { validateConstructorArg, ValidationResult } from '../services/validationService';
import { walletConnectService } from '../services/walletConnectService';
import { Button } from './UI';

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
                    const session = walletConnectService.getSession();
                    const bchNS = session?.namespaces?.['bch'];
                    pkValue = (bchNS as any)?.metadata?.pubkey || (bchNS as any)?.metadata?.publicKey || '';
                }

                if (pkValue && nextValues[input.name] !== pkValue) {
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
            {/* Wallet Integration Section (Early Autofill) */}
            <div className="p-3 bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-xl mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <Wallet size={14} className="text-nexus-cyan" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Identity Provisioning</span>
                    </div>
                    {burnerAddress ? (
                        <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-2">
                            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Active Burner</span>
                        </div>
                    ) : walletConnectService.isConnected() ? (
                        <div className="flex items-center space-x-1 animate-in fade-in slide-in-from-right-2">
                            <span className="w-1 h-1 rounded-full bg-nexus-cyan animate-pulse"></span>
                            <span className="text-[8px] font-black text-nexus-cyan uppercase tracking-widest">Wallet Linked</span>
                        </div>
                    ) : (
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">No Wallet Active</span>
                    )}
                </div>

                {!burnerAddress && !walletConnectService.isConnected() ? (
                    <div className="grid grid-cols-1 gap-2">
                        <Button
                            variant="glass"
                            size="sm"
                            className="w-full flex items-center justify-center space-x-2 py-3 border-nexus-cyan/20 hover:border-nexus-cyan/50 h-auto"
                            onClick={onGenerateBurner}
                            disabled={isGeneratingBurner}
                        >
                            {isGeneratingBurner ? (
                                <Loader2 size={16} className="animate-spin text-nexus-cyan" />
                            ) : (
                                <Zap size={16} className="text-nexus-cyan" />
                            )}
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase text-white leading-none">Generate Burner</div>
                                <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-1">Instant Pubkey Autofill</div>
                            </div>
                        </Button>
                    </div>
                ) : burnerAddress ? (
                    <div className="p-2 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between group">
                        <div className="flex items-center space-x-3 truncate mr-4">
                            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20 shrink-0">
                                <Activity size={14} className="text-green-500" />
                            </div>
                            <div className="truncate">
                                <div className="text-[10px] font-black text-white uppercase tracking-tighter truncate">Burner Loaded</div>
                                <div className="text-[8px] font-mono text-slate-500 truncate">{burnerAddress}</div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="px-1.5 py-0.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded text-[8px] font-bold uppercase tracking-widest">Sync</div>
                            <button className="p-1 hover:bg-white/5 rounded transition-colors" onClick={onGenerateBurner}>
                                <RefreshCw size={10} className="text-slate-500" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-2 bg-black/40 border border-white/5 rounded-lg flex items-center justify-between">
                        <div className="flex items-center space-x-3 truncate">
                            <div className="w-8 h-8 rounded-full bg-nexus-cyan/10 flex items-center justify-center border border-nexus-cyan/20 shrink-0">
                                <Wallet size={14} className="text-nexus-cyan" />
                            </div>
                            <div className="truncate">
                                <div className="text-[10px] font-black text-white uppercase tracking-tighter truncate">WalletConnect Session</div>
                                <div className="text-[8px] font-mono text-slate-500 truncate">{walletConnectService.getSession()?.peer?.metadata?.name || 'External Wallet'}</div>
                            </div>
                        </div>
                        <CheckCircle size={14} className="text-nexus-cyan shrink-0 ml-2" />
                    </div>
                )}
            </div>

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

                            <input
                                value={fieldValues[inp.name] || ''}
                                onChange={(e) => handleFieldChange(inp.name, e.target.value, inp.type)}
                                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                                className={`w-full bg-black/50 border ${borderColor} rounded px-2 py-1.5 text-xs font-mono text-gray-300 focus:border-cyan-500 outline-none transition-colors`}
                                placeholder={`Value for ${inp.name}`}
                            />
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
