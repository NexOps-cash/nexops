import React from 'react';
import { BookOpen, Users, Settings2, AlertTriangle } from 'lucide-react';
import { ContractExplanation } from '../services/groqService';

export const ExplainPanelView: React.FC<{ data: ContractExplanation }> = ({ data }) => {
    return (
        <div className="flex flex-col space-y-4 bg-[#0a0a0c] p-4 rounded-lg border border-white/5 font-sans mt-2">
            {/* Summary Layer */}
            <div className="space-y-2">
                <div className="flex items-center space-x-2 text-nexus-cyan mb-2">
                    <BookOpen size={16} />
                    <h3 className="text-sm font-black uppercase tracking-widest">Contract Overview</h3>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed border-l-2 border-nexus-cyan/30 pl-3 py-1">
                    {data.summary}
                </p>
            </div>

            {/* Roles Layer */}
            {data.roles && data.roles.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-purple-400 mb-3">
                        <Users size={16} />
                        <h3 className="text-sm font-black uppercase tracking-widest">Roles</h3>
                    </div>
                    <div className="grid gap-3">
                        {data.roles.map((role, i) => (
                            <div key={i} className="flex flex-col bg-white/5 rounded p-3 border border-white/5">
                                <span className="text-base font-bold text-slate-200">{role.name}</span>
                                <span className="text-sm text-slate-400 mt-1.5 flex items-start">
                                    <span className="text-purple-500 mr-2 font-bold">→</span>
                                    {role.description}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Functions Layer */}
            {data.functions && data.functions.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-blue-400 mb-3">
                        <Settings2 size={16} />
                        <h3 className="text-sm font-black uppercase tracking-widest">Functions</h3>
                    </div>
                    <div className="space-y-4">
                        {data.functions.map((fn, i) => (
                            <div key={i} className="bg-[#0d1425] rounded p-4 border border-blue-500/20 shadow-sm">
                                <div className="text-base font-mono font-bold text-blue-400 mb-2">{fn.name}()</div>
                                <div className="text-sm text-slate-300 mb-3 leading-relaxed">{fn.description}</div>

                                {fn.conditions && fn.conditions.length > 0 && (
                                    <div className="space-y-2 mb-3 bg-black/30 p-3 rounded-lg">
                                        {fn.conditions.map((cond, j) => (
                                            <div key={j} className="text-sm text-slate-400 flex items-start">
                                                <span className="text-blue-500/50 mr-2.5 opacity-80 select-none">♦</span>
                                                <span className="leading-snug">{cond}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="text-sm text-green-400 flex items-start bg-green-900/10 p-3 rounded border border-green-500/10">
                                    <span className="font-black mr-2 opacity-80 tracking-widest">RESULT:</span>
                                    <span className="opacity-90 leading-tight">{fn.result}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risks Layer */}
            {data.risks && data.risks.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-yellow-500 mb-3">
                        <AlertTriangle size={16} />
                        <h3 className="text-sm font-black uppercase tracking-widest">Risk Notes</h3>
                    </div>
                    <div className="space-y-3">
                        {data.risks.map((risk, i) => {
                            const colors = {
                                'LOW': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                'MEDIUM': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                                'HIGH': 'text-red-400 bg-red-500/10 border-red-500/20'
                            };
                            const riskColor = colors[risk.level as keyof typeof colors] || colors['MEDIUM'];

                            return (
                                <div key={i} className={`flex flex-col p-3.5 rounded border ${riskColor}`}>
                                    <span className="text-sm font-black uppercase tracking-widest mb-1.5">{risk.level} RISK</span>
                                    <span className="text-sm opacity-90 leading-relaxed">{risk.description}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
