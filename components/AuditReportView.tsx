import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Shield, Zap } from 'lucide-react';
import { AuditReport, Vulnerability } from '../types';
import { Button } from './UI';

interface AuditReportViewProps {
    report: AuditReport;
    onFix: (vulnerability: Vulnerability) => void;
}

export const AuditReportView: React.FC<AuditReportViewProps> = ({ report, onFix }) => {
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    const toggleExpand = (idx: number) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(idx)) {
            newSet.delete(idx);
        } else {
            newSet.add(idx);
        }
        setExpandedIds(newSet);
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'HIGH': return 'text-red-500 bg-red-500/10 border-red-500/20';
            case 'MEDIUM': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
            case 'LOW': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        }
    };

    return (
        <div className="bg-[#111] border border-[#2a2a2a] rounded-lg overflow-hidden my-2">
            {/* Header */}
            <div className="p-3 border-b border-[#2a2a2a] flex items-center justify-between bg-[#151515]">
                <div className="flex items-center gap-2">
                    <Shield className={report.score < 50 ? 'text-red-500' : report.score < 80 ? 'text-yellow-500' : 'text-green-500'} size={16} />
                    <span className="font-bold text-sm text-gray-200">Security Audit</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Score</span>
                    <span className={`text-sm font-black ${report.score < 50 ? 'text-red-500' : report.score < 80 ? 'text-yellow-500' : 'text-green-500'}`}>
                        {report.score}/100
                    </span>
                </div>
            </div>

            {/* Summary */}
            <div className="p-3 text-xs text-gray-400 border-b border-[#2a2a2a]">
                {report.summary}
            </div>

            {/* Vulnerabilities List */}
            <div className="divide-y divide-[#2a2a2a]">
                {report.vulnerabilities.map((vuln, idx) => (
                    <div key={idx} className="bg-[#0d0d0d]">
                        <div
                            className="flex items-center p-3 cursor-pointer hover:bg-[#151515] transition-colors"
                            onClick={() => toggleExpand(idx)}
                        >
                            <button className="mr-2 text-gray-500">
                                {expandedIds.has(idx) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>

                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold border mr-3 ${getSeverityColor(vuln.severity)}`}>
                                {vuln.severity}
                            </div>

                            <div className="flex-1 text-xs text-gray-300 font-medium truncate">
                                {vuln.title}
                            </div>

                            {vuln.line && (
                                <span className="text-[9px] font-mono text-gray-600 mr-2">
                                    Ln {vuln.line}
                                </span>
                            )}
                        </div>

                        {/* Details */}
                        {expandedIds.has(idx) && (
                            <div className="px-10 pb-4 text-xs space-y-3 bg-[#111] animate-in slide-in-from-top-2 duration-200">
                                <div className="text-gray-400 leading-relaxed">
                                    {vuln.description}
                                </div>
                                <div className="bg-[#0a0a0a] p-2 rounded border border-[#222]">
                                    <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1 font-bold">Recommendation</div>
                                    <div className="text-gray-300 font-mono text-[10px]">
                                        {vuln.fixSuggestion}
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="w-full justify-center border border-nexus-cyan/20 bg-nexus-cyan/5 text-nexus-cyan hover:bg-nexus-cyan/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onFix(vuln);
                                    }}
                                >
                                    <Zap size={10} className="mr-1.5" />
                                    Apply AI Fix
                                </Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {report.vulnerabilities.length === 0 && (
                <div className="p-6 text-center text-gray-500 text-xs">
                    <CheckCircle className="mx-auto mb-2 text-green-500/50" size={24} />
                    <p>No vulnerabilities found.</p>
                </div>
            )}
        </div>
    );
};
