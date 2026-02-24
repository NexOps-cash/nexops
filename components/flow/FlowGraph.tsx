import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useContractFlow } from './useContractFlow';

interface FlowGraphProps {
    artifact: any;
    sourceCode: string;
}

export const FlowGraph: React.FC<FlowGraphProps> = ({ artifact, sourceCode }) => {
    const { nodes: rawNodes, edges: rawEdges } = useContractFlow(artifact, sourceCode);

    // Compute topological levels and simple horizontal positioning
    const { nodeLevels, nodeX } = useMemo(() => {
        const levels: Record<string, number> = {};
        const xs: Record<string, number> = {};

        const root = rawNodes.find(n => n.type === 'contract');

        let changed = true;
        if (root) {
            levels[root.id] = 0;
            xs[root.id] = 250;
        }

        while (changed) {
            changed = false;
            rawEdges.forEach(e => {
                if (levels[e.source] !== undefined) {
                    const targetLevel = levels[e.source] + 1;
                    if (levels[e.target] === undefined || levels[e.target] < targetLevel) {
                        levels[e.target] = targetLevel;
                        changed = true;
                    }
                }
            });
        }

        const childrenMap: Record<string, string[]> = {};
        rawEdges.forEach(e => {
            if (!childrenMap[e.source]) childrenMap[e.source] = [];
            childrenMap[e.source].push(e.target);
        });

        // BFS for centered X positioning
        if (root) {
            const queue: string[] = [root.id];

            while (queue.length > 0) {
                const current = queue.shift()!;
                const children = childrenMap[current] || [];

                if (children.length > 0) {
                    const spacing = 200;
                    const parentX = xs[current] || 250;
                    const startX = parentX - (spacing * (children.length - 1)) / 2;

                    children.forEach((childId, index) => {
                        if (xs[childId] === undefined) {
                            xs[childId] = startX + index * spacing;
                            queue.push(childId);
                        }
                    });
                }
            }
        }

        return { nodeLevels: levels, nodeX: xs };
    }, [rawNodes, rawEdges]);

    const initialNodes: Node[] = useMemo(() => rawNodes.map((n) => {
        let style: React.CSSProperties = {
            padding: '10px 20px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#fff',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            minWidth: '200px'
        };

        if (n.type === 'contract') {
            style.backgroundColor = '#0f172a';
            style.border = '2px solid #06b6d4'; // cyan
            style.fontSize = '14px';
        } else if (n.type === 'function') {
            style.backgroundColor = '#1e293b';
            style.border = '2px solid #475569'; // gray
        } else if (n.type === 'condition') {
            style.backgroundColor = '#1e3a8a';
            style.border = '2px solid #3b82f6'; // blue
            style.borderRadius = '20px'; // pill shape
        } else if (n.type === 'success') {
            style.backgroundColor = '#052e16';
            style.border = '2px solid #22c55e'; // green
        } else if (n.type === 'failure') {
            style.backgroundColor = '#450a0a';
            style.border = '2px solid #ef4444'; // red
        } else if (n.type === 'validation') {
            style.backgroundColor = '#7c2d12';
            style.border = '2px solid #f97316'; // orange
        }

        const verticalSpacing = 160;
        const y = (nodeLevels[n.id] || 0) * verticalSpacing;
        const x = nodeX[n.id] || 250;

        return {
            id: n.id,
            position: { x, y },
            data: { label: n.label },
            style
        };
    }), [rawNodes, nodeLevels, nodeX]);

    const initialEdges: Edge[] = useMemo(() => rawEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: '#94a3b8' }
    })), [rawEdges]);

    return (
        <div style={{ height: '600px', width: '100%', backgroundColor: '#020617' }}>
            {initialNodes.length > 0 ? (
                <ReactFlow
                    nodes={initialNodes}
                    edges={initialEdges}
                    fitView
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#1e293b" gap={16} />
                    <Controls showInteractive={false} />
                </ReactFlow>
            ) : (
                <div className="flex h-full items-center justify-center text-slate-500 font-mono text-xs">
                    No Artifact Data Found
                </div>
            )}
        </div>
    );
};
