import React from 'react';

interface DebugStackVisualizerProps {
    stack: string[]; // 0 is bottom, length-1 is top
    altStack: string[];
}

export const DebugStackVisualizer: React.FC<DebugStackVisualizerProps> = ({ stack, altStack }) => {
    // Visualizer expectation: Top of stack (end of array) should be at the TOP of the list.
    // We reverse the array for display so index 0 is the TOP item.
    const displayStack = [...stack].reverse();
    const displayAlt = [...altStack].reverse();

    return (
        <div className="flex-1 flex flex-col space-y-4 p-4 h-full overflow-hidden">
            {/* Main Stack */}
            <div className="flex-1 flex flex-col border border-slate-700 bg-slate-900/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 flex justify-between">
                    <span>MAIN STACK</span>
                    <span className="text-nexus-cyan">{stack.length} items</span>
                </div>
                <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {displayStack.length === 0 && <div className="text-center text-slate-600 text-[10px] py-10 opacity-50">Stack Empty</div>}
                    {displayStack.map((item, i) => (
                        <div key={i} className="bg-slate-800/80 border border-slate-600/50 rounded px-2 py-1.5 text-xs font-mono text-nexus-cyan shadow-sm flex items-center justify-between group hover:border-nexus-cyan/50 transition-colors cursor-default">
                            <span className="select-all">{item}</span>
                            <span className="text-[9px] text-slate-600 group-hover:text-slate-500">{(stack.length - 1 - i)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Alt Stack (Collapse if empty? No keep visible for structure) */}
            <div className="h-1/3 flex flex-col border border-slate-700 bg-slate-900/50 rounded-lg overflow-hidden">
                <div className="bg-slate-800 px-3 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 flex justify-between">
                    <span>ALT STACK</span>
                    <span className="text-slate-500">{altStack.length}</span>
                </div>
                <div className="flex-1 p-2 space-y-1 overflow-y-auto custom-scrollbar">
                    {displayAlt.length === 0 && <div className="text-center text-slate-600 text-[10px] py-4 opacity-50">Empty</div>}
                    {displayAlt.map((item, i) => (
                        <div key={i} className="bg-slate-800 border border-slate-600/50 rounded px-2 py-1 text-xs font-mono text-slate-400">
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
