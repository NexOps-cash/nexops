import React, { useState } from 'react';
import { HelpCircle, AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { ContractArtifact } from '../services/compilerService';
import { validateConstructorArg, ValidationResult } from '../services/validationService';

interface ConstructionProps {
    inputs: ContractArtifact['constructorInputs'];
    values?: string[]; // Added prop for persistence
    onChange: (args: string[], validations: Record<string, ValidationResult>) => void;
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

export const ConstructorForm: React.FC<ConstructionProps> = ({ inputs, values, onChange }) => {
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

    // Use effect to propagate changes when fields or validations update from user input
    React.useEffect(() => {
        const orderedArgs = inputs.map(inp => fieldValues[inp.name] || '');
        onChange(orderedArgs, fieldValidations);
    }, [fieldValues, fieldValidations]); // removed onChange and inputs from dependency array to prevent infinite loops if they aren't memoized

    const validateField = (name: string, val: string, type: string) => {
        if (!val) {
            setFieldValidations(prev => ({ ...prev, [name]: { isValid: true, severity: 'info', message: '' } }));
            return;
        }

        const result = validateConstructorArg(val, type, name);
        setFieldValidations(prev => ({ ...prev, [name]: result }));
    };

    const onInputChange = (name: string, val: string, type: string) => {
        const newValidation = val ? validateConstructorArg(val, type, name) : { isValid: true, severity: 'info', message: '' };

        setFieldValues(prev => ({ ...prev, [name]: val }));
        setFieldValidations(prev => ({ ...prev, [name]: newValidation as ValidationResult }));
    };

    if (inputs.length === 0) return null;

    return (
        <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase">
                <div className="flex items-center">
                    <HelpCircle className="w-3 h-3 mr-2" />
                    Configuration
                </div>
            </div>
            <div className="space-y-3">
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
                                onChange={(e) => onInputChange(inp.name, e.target.value, inp.type)}
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
