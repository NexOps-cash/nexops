import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useContractFlow } from './useContractFlow';

interface FlowGraphProps {
    artifact: any;
    sourceCode: string;
}

export const FlowGraph: React.FC<FlowGraphProps> = ({ artifact, sourceCode }) => {
    const { nodes: rawNodes, edges: rawEdges, orderedSteps } = useContractFlow(artifact, sourceCode);

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

        // Calculate leaves count for each subtree
        const leavesCount: Record<string, number> = {};
        const getLeaves = (id: string): number => {
            const children = childrenMap[id] || [];
            if (children.length === 0) {
                leavesCount[id] = 1;
                return 1;
            }
            let sum = 0;
            for (const c of children) {
                sum += getLeaves(c);
            }
            leavesCount[id] = sum;
            return sum;
        };

        if (root) {
            getLeaves(root.id);

            // Top-down layout dividing horizontal boundaries proportionally by leaf count
            const queue: { id: string, leftBoundary: number, rightBoundary: number }[] = [];
            const leafWidth = 280; // pixels per leaf

            queue.push({
                id: root.id,
                leftBoundary: 0,
                rightBoundary: leavesCount[root.id] * leafWidth
            });

            // Offset to ensure the root centers roughly around 250 like previous logic
            const treeWidth = leavesCount[root.id] * leafWidth;
            const offsetX = 250 - (treeWidth / 2);

            while (queue.length > 0) {
                const { id, leftBoundary, rightBoundary } = queue.shift()!;

                xs[id] = ((leftBoundary + rightBoundary) / 2) + offsetX;

                const children = childrenMap[id] || [];
                let currentZ = leftBoundary;

                for (const childId of children) {
                    const childWidth = leavesCount[childId] * leafWidth;
                    // Only process nodes if they haven't been positioned yet (prevents cyclic loops if any)
                    if (xs[childId] === undefined) {
                        queue.push({
                            id: childId,
                            leftBoundary: currentZ,
                            rightBoundary: currentZ + childWidth
                        });
                    }
                    currentZ += childWidth;
                }
            }
        }

        return { nodeLevels: levels, nodeX: xs };
    }, [rawNodes, rawEdges]);

    const initialNodes: Node[] = useMemo(() => rawNodes.map((n) => {
        let style: React.CSSProperties = {
            padding: '10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#fff',
            backgroundColor: '#1e293b',
            border: '1px solid #475569',
            minWidth: '180px',
            maxWidth: '260px',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            wordBreak: 'break-word',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        };

        if (n.type === 'contract') {
            style.backgroundColor = '#0f172a';
            style.border = '2px solid #06b6d4'; // cyan
            style.fontSize = '14px';
        } else if (n.type === 'function') {
            style.backgroundColor = '#1e293b';
            style.border = '2px solid #475569'; // gray
        } else if (n.type === 'condition') {
            const stepDepth = orderedSteps.find(s => s.id.replace('step', 'cond') === n.id.replace('step', 'cond') || s.label === n.label)?.depth || 1;

            if (n.label.includes('&&')) {
                style.backgroundColor = '#172554'; // darkest blue
                style.border = '2px solid #2563eb';
            } else if (stepDepth >= 3) {
                style.backgroundColor = '#1e3a8a'; // darker blue
                style.border = '2px solid #3b82f6';
            } else if (stepDepth === 2) {
                style.backgroundColor = '#2563eb'; // standard blue
                style.border = '2px solid #60a5fa';
            } else {
                style.backgroundColor = '#3b82f6'; // lighter blue
                style.border = '2px solid #93c5fd';
            }
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

    const initialEdges: Edge[] = useMemo(() => rawEdges.map(e => {
        const isTrue = e.label === 'True';
        const isFalse = e.label === 'False';

        return {
            id: e.id,
            source: e.source,
            target: e.target,
            animated: true,
            label: e.label,
            labelStyle: { fill: '#cbd5e1', fontWeight: 700, fontSize: 11, fontFamily: 'monospace' },
            labelBgStyle: { fill: '#1e293b', stroke: '#475569', strokeOpacity: 0.8 },
            style: {
                stroke: isTrue ? '#4ade80' : isFalse ? '#ef4444' : '#94a3b8',
                strokeDasharray: isFalse ? '4 2' : undefined
            }
        };
    }), [rawEdges]);

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
