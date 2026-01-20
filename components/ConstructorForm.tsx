import React, { useState, useEffect } from 'react';
import { HelpCircle, AlertCircle } from 'lucide-react';
import { ContractArtifact } from '../services/compilerService';

interface ConstructionProps {
    inputs: ContractArtifact['constructorInputs'];
    onChange: (args: string[]) => void;
}

export const ConstructorForm: React.FC<ConstructionProps> = ({ inputs, onChange }) => {
    const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    // Debounce updates
    useEffect(() => {
        const handler = setTimeout(() => {
            const orderedArgs = inputs.map(inp => fieldValues[inp.name] || '');
            onChange(orderedArgs);
        }, 200);
        return () => clearTimeout(handler);
    }, [fieldValues, inputs, onChange]);

    const validateField = (name: string, val: string, type: string) => {
        let err = '';
        if (type.startsWith('int') && val) {
            try { BigInt(val); } catch { err = 'Invalid integer'; }
        }
        if (type === 'pubkey' && val && val.length !== 66) err = 'Must be 33 bytes (66 hex chars)';
        setFieldErrors(prev => ({ ...prev, [name]: err }));
    };

    const onInputChange = (name: string, val: string, type: string) => {
        setFieldValues(prev => ({ ...prev, [name]: val }));
        validateField(name, val, type);
    };

    if (inputs.length === 0) return null;

    return (
        <div className="space-y-3 p-3 bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center text-xs text-gray-400 font-bold uppercase">
                <HelpCircle className="w-3 h-3 mr-2" />
                Configuration
            </div>
            <div className="space-y-3">
                {inputs.map((inp, idx) => (
                    <div key={idx}>
                        <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                            <span>{inp.name}</span>
                            <span className="text-cyan-500">{inp.type}</span>
                        </div>
                        <input
                            value={fieldValues[inp.name] || ''}
                            onChange={(e) => onInputChange(inp.name, e.target.value, inp.type)}
                            className={`w-full bg-black/50 border ${fieldErrors[inp.name] ? 'border-red-500' : 'border-gray-700'} rounded px-2 py-1.5 text-xs font-mono text-gray-300 focus:border-cyan-500 outline-none`}
                            placeholder={`Value for ${inp.name}`}
                        />
                        {fieldErrors[inp.name] && (
                            <div className="flex items-center mt-1 text-red-400 text-[10px]">
                                <AlertCircle className="w-3 h-3 mr-1" /> {fieldErrors[inp.name]}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
