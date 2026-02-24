import React from 'react';
import { useContractFlow } from './useContractFlow';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface ExecutionPreviewProps {
    artifact: any;
    sourceCode: string;
    securityScore?: number;
}

export const ExecutionPreview: React.FC<ExecutionPreviewProps> = ({ artifact, sourceCode, securityScore = 1.0 }) => {
    const { orderedSteps } = useContractFlow(artifact, sourceCode);

    const isSecure = securityScore >= 0.9;

    return (
        <div className="flex flex-col h-full bg-[#0d1425] border-l border-white/5 text-slate-300">
            {/* Header */}
            <div className="p-4 border-b border-white/5 bg-[#0f172a]">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Deterministic Execution Preview</h3>
                <div className={`flex items-center space-x-2 text-xs font-bold ${isSecure ? 'text-green-500' : 'text-yellow-500'}`}>
                    {isSecure ? (
                        <>
                            <CheckCircle size={14} />
                            <span>Structure Validated</span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={14} />
                            <span>Structural Risk Detected</span>
                        </>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
                {orderedSteps.map((step) => {
                    let bgColor = 'bg-slate-800/80';
                    let textColor = 'text-slate-300';

                    if (step.type === 'contract') {
                        textColor = 'text-nexus-cyan font-bold';
                        bgColor = 'bg-nexus-cyan/10 border border-nexus-cyan/30';
                    } else if (step.type === 'function') {
                        bgColor = 'bg-slate-800/50 border border-slate-700/50';
                    } else if (step.type === 'condition') {
                        if (step.label.includes('&&')) {
                            textColor = 'text-blue-300';
                            bgColor = 'bg-blue-950/40 border border-blue-600/30';
                        } else {
                            textColor = 'text-blue-400';
                            bgColor = 'bg-blue-900/20 border border-blue-500/30';
                        }
                    } else if (step.type === 'success') {
                        bgColor = 'bg-green-900/20 border border-green-500/30';
                        textColor = 'text-green-400 font-bold';
                    } else if (step.type === 'failure') {
                        bgColor = 'bg-red-900/20 border border-red-500/30';
                        textColor = 'text-red-400 font-bold';
                    } else if (step.type === 'validation') {
                        bgColor = 'bg-orange-900/20 border border-orange-500/30';
                        textColor = 'text-orange-400';
                    }

                    return (
                        <div
                            key={step.id}
                            style={{ marginLeft: `${step.depth * 1.5}rem` }}
                            className={`flex items-start space-x-3 p-2 rounded ${bgColor}`}
                        >
                            <span className="opacity-40 select-none min-w-[20px] text-right">
                                {step.order}
                            </span>
                            <span className={textColor}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}

                {orderedSteps.length === 0 && (
                    <div className="text-center opacity-40 mt-10">
                        No structural data available. Compile a contract first.
                    </div>
                )}
            </div>
        </div>
    );
};
