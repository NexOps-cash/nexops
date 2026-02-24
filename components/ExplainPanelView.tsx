import React from 'react';
import { BookOpen, Users, Settings2, AlertTriangle } from 'lucide-react';
import { ContractExplanation } from '../services/groqService';

export const ExplainPanelView: React.FC<{ data: ContractExplanation }> = ({ data }) => {
    return (
        <div className="flex flex-col space-y-4 bg-[#0a0a0c] p-4 rounded-lg border border-white/5 font-sans mt-2">
            {/* Summary Layer */}
            <div className="space-y-2">
                <div className="flex items-center space-x-2 text-nexus-cyan mb-1">
                    <BookOpen size={14} />
                    <h3 className="text-xs font-black uppercase tracking-widest">Contract Overview</h3>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed border-l-2 border-nexus-cyan/30 pl-3 py-0.5">
                    {data.summary}
                </p>
            </div>

            {/* Roles Layer */}
            {data.roles && data.roles.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-purple-400 mb-2">
                        <Users size={14} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Roles</h3>
                    </div>
                    <div className="grid gap-2">
                        {data.roles.map((role, i) => (
                            <div key={i} className="flex flex-col bg-white/5 rounded p-2.5 border border-white/5">
                                <span className="text-[11px] font-bold text-slate-200">{role.name}</span>
                                <span className="text-[10px] text-slate-400 mt-1 flex items-start">
                                    <span className="text-purple-500 mr-1.5 font-bold">→</span>
                                    {role.description}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Functions Layer */}
            {data.functions && data.functions.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-blue-400 mb-2">
                        <Settings2 size={14} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Functions</h3>
                    </div>
                    <div className="space-y-3">
                        {data.functions.map((fn, i) => (
                            <div key={i} className="bg-[#0d1425] rounded p-2.5 border border-blue-500/20">
                                <div className="text-[11px] font-mono font-bold text-blue-400 mb-1.5">{fn.name}()</div>
                                <div className="text-[10px] text-slate-300 mb-2 leading-relaxed">{fn.description}</div>

                                {fn.conditions && fn.conditions.length > 0 && (
                                    <div className="space-y-1 mb-2.5 bg-black/20 p-2 rounded">
                                        {fn.conditions.map((cond, j) => (
                                            <div key={j} className="text-[9px] text-slate-400 flex items-start">
                                                <span className="text-blue-500/50 mr-1.5 opacity-80">♦</span>
                                                {cond}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="text-[10px] text-green-400 flex items-start bg-green-900/10 p-2 rounded border border-green-500/10">
                                    <span className="font-bold mr-1.5 opacity-80">RESULT:</span>
                                    <span className="opacity-90 leading-tight">{fn.result}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Risks Layer */}
            {data.risks && data.risks.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                    <div className="flex items-center space-x-2 text-yellow-500 mb-2">
                        <AlertTriangle size={14} />
                        <h3 className="text-xs font-black uppercase tracking-widest">Risk Notes</h3>
                    </div>
                    <div className="space-y-2">
                        {data.risks.map((risk, i) => {
                            const colors = {
                                'LOW': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                                'MEDIUM': 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
                                'HIGH': 'text-red-400 bg-red-500/10 border-red-500/20'
                            };
                            const riskColor = colors[risk.level as keyof typeof colors] || colors['MEDIUM'];

                            return (
                                <div key={i} className={`flex flex-col p-2.5 rounded border ${riskColor}`}>
                                    <span className="text-[9px] font-black uppercase tracking-widest mb-1">{risk.level} RISK</span>
                                    <span className="text-[10px] opacity-90">{risk.description}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
