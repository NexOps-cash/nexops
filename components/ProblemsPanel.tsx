import React from 'react';
import { AlertTriangle, XCircle, FileWarning } from 'lucide-react';

export interface Problem {
    id: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    file: string;
    line?: number;
    column?: number;
}

interface ProblemsPanelProps {
    problems: Problem[];
    onNavigate: (file: string, line?: number) => void;
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({ problems, onNavigate }) => {
    if (problems.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50">
                <FileWarning size={32} className="mb-2" />
                <p className="text-xs">No problems detected in workspace.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="bg-slate-800/50 sticky top-0 md:text-[10px] text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    <tr>
                        <th className="py-2 px-4 w-12 text-center">Type</th>
                        <th className="py-2 px-2">Description</th>
                        <th className="py-2 px-2 w-32">File</th>
                        <th className="py-2 px-2 w-16 text-right">Line</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-mono">
                    {problems.map(problem => (
                        <tr
                            key={problem.id}
                            className="hover:bg-white/5 cursor-pointer transition-colors group"
                            onClick={() => onNavigate(problem.file, problem.line)}
                        >
                            <td className="py-1 px-4 text-center">
                                {problem.severity === 'error' ? (
                                    <XCircle size={14} className="text-nexus-warning inline-block" />
                                ) : (
                                    <AlertTriangle size={14} className="text-yellow-400 inline-block" />
                                )}
                            </td>
                            <td className="py-1 px-2 text-slate-300 group-hover:text-white truncate max-w-lg" title={problem.message}>
                                {problem.message}
                            </td>
                            <td className="py-1 px-2 text-slate-500 group-hover:text-nexus-cyan truncate">
                                {problem.file}
                            </td>
                            <td className="py-1 px-2 text-right text-slate-600 group-hover:text-slate-400">
                                {problem.line ? `:${problem.line}` : ''}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
