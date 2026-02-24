import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useContractFlow } from './useContractFlow';

interface FlowGraphProps {
    artifact: any;
}

export const FlowGraph: React.FC<FlowGraphProps> = ({ artifact }) => {
    const { nodes: rawNodes, edges: rawEdges } = useContractFlow(artifact);

    const initialNodes: Node[] = useMemo(() => rawNodes.map((n, index) => {
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
            style.border = '2px solid #06b6d4'; // nexus-cyan
            style.fontSize = '14px';
        } else if (n.type === 'result') {
            style.backgroundColor = '#1e293b';
            style.border = '2px solid #22c55e'; // green
        }

        return {
            id: n.id,
            position: { x: 250, y: index * 140 },
            data: { label: n.label },
            style
        };
    }), [rawNodes]);

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
