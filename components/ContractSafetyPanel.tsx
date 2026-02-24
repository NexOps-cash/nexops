import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Lock, FileCode } from 'lucide-react';
import { ValidationResult } from '../services/validationService';
import { ContractArtifact } from '../services/compilerService';

interface ContractSafetyPanelProps {
    artifact: ContractArtifact | null;
    validations: Record<string, ValidationResult>;
    derivedAddress: string;
}

export const ContractSafetyPanel: React.FC<ContractSafetyPanelProps> = ({
    artifact,
    validations,
    derivedAddress
}) => {
    if (!artifact) return null;

    const validationEntries = Object.entries(validations);
    const hasErrors = validationEntries.some(([_, v]) => (v as ValidationResult).severity === 'error');
    const hasWarnings = validationEntries.some(([_, v]) => (v as ValidationResult).severity === 'warning');
    const allValid = validationEntries.length > 0 && validationEntries.every(([_, v]) => (v as ValidationResult).isValid);

    const isFundable = !hasErrors && derivedAddress;

    return (
        <div className="p-4 bg-nexus-900/50 border border-nexus-700 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase text-gray-400 flex items-center">
                    <Lock className="w-3 h-3 mr-1.5" />
                    Contract Safety
                </h4>
                {isFundable ? (
                    <span className="text-green-400 text-[10px] font-bold flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        FUNDABLE
                    </span>
                ) : (
                    <span className="text-red-400 text-[10px] font-bold flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        NOT FUNDABLE
                    </span>
                )}
            </div>

            <div className="space-y-2">
                {/* Constructor Types Valid */}
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Constructor types valid</span>
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                </div>

                {/* Validation Status per Input */}
                {artifact.constructorInputs.map((input, idx) => {
                    const validation = validations[input.name];
                    if (!validation || !validation.message) return null;

                    return (
                        <div key={idx} className="flex items-start justify-between text-[11px]">
                            <span className="text-gray-400 flex-1">
                                {input.name} ({input.type})
                            </span>
                            <div className="flex items-center ml-2">
                                {validation.severity === 'error' && (
                                    <>
                                        <AlertCircle className="w-3.5 h-3.5 text-red-400 mr-1" />
                                        <span className="text-red-400 text-[10px]">Invalid</span>
                                    </>
                                )}
                                {validation.severity === 'warning' && (
                                    <>
                                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mr-1" />
                                        <span className="text-yellow-400 text-[10px]">Warning</span>
                                    </>
                                )}
                                {validation.severity === 'info' && validation.isValid && (
                                    <>
                                        <CheckCircle className="w-3.5 h-3.5 text-green-400 mr-1" />
                                        <span className="text-green-400 text-[10px]">Valid</span>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Fundable Status */}
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-nexus-700">
                    <span className="text-gray-400">Contract fundable</span>
                    {isFundable ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                </div>
            </div>

            {/* Derived Internals (Optional) */}
            {derivedAddress && (
                <div className="pt-3 border-t border-nexus-700 space-y-2">
                    <div className="text-[10px] text-gray-500 uppercase font-bold">Derived Internals</div>

                    <div>
                        <div className="text-[10px] text-gray-400 mb-1">Script Hash (HASH160)</div>
                        <div className="font-mono text-[9px] bg-black/50 p-1.5 rounded text-gray-500 break-all">
                            {artifact.scriptHash || 'Computing...'}
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] text-gray-400 mb-1">Network</div>
                        <div className="inline-block px-2 py-0.5 bg-nexus-cyan/20 border border-nexus-cyan/30 rounded text-nexus-cyan text-[10px] font-bold">
                            TESTNET
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
