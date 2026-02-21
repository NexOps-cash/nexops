import React, { useCallback, useMemo } from 'react';
import {
    ReactFlow,
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    Connection,
    Edge,
    Node,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    BackgroundVariant,
    Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
    AccountNode,
    PaymentNode,
    ContractCallNode,
    LogicNode
} from './FlowNodes';
import {
    Plus, Play, Save, Trash2,
    Download, Share2, Grid3X3, Wallet,
    Send, Zap, GitBranch
} from 'lucide-react';
import { Button } from '../UI';

const nodeTypes = {
    account: AccountNode,
    payment: PaymentNode,
    contract: ContractCallNode,
    logic: LogicNode,
};

const initialNodes: Node[] = [
    {
        id: '1',
        type: 'account',
        position: { x: 100, y: 100 },
        data: { label: 'Primary Account', config: { address: 'bitcoincash:qr8v...' } }
    },
];

const initialEdges: Edge[] = [];

export const FlowPalette: React.FC<{ onAddNode: (type: string) => void }> = ({ onAddNode }) => (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section>
            <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Essentials</h4>
            <div className="space-y-2">
                <button
                    onClick={() => onAddNode('account')}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
                >
                    <div className="p-1.5 rounded bg-blue-500/20 text-blue-500 group-hover:scale-110 transition-transform">
                        <Wallet size={14} />
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white leading-none">Account</p>
                        <p className="text-[9px] text-slate-500 mt-1">Funding Source</p>
                    </div>
                </button>

                <button
                    onClick={() => onAddNode('payment')}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
                >
                    <div className="p-1.5 rounded bg-green-500/20 text-green-500 group-hover:scale-110 transition-transform">
                        <Send size={14} />
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white leading-none">Payment</p>
                        <p className="text-[9px] text-slate-500 mt-1">Send BCH</p>
                    </div>
                </button>
            </div>
        </section>

        <section>
            <h4 className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-3">Smart Execution</h4>
            <div className="space-y-2">
                <button
                    onClick={() => onAddNode('contract')}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-all group"
                >
                    <div className="p-1.5 rounded bg-yellow-500/20 text-yellow-500 group-hover:scale-110 transition-transform">
                        <Zap size={14} />
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white leading-none">Contract Call</p>
                        <p className="text-[9px] text-slate-500 mt-1">Interact with Script</p>
                    </div>
                </button>

                <button
                    onClick={() => onAddNode('logic')}
                    className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
                >
                    <div className="p-1.5 rounded bg-purple-500/20 text-purple-500 group-hover:scale-110 transition-transform">
                        <GitBranch size={14} />
                    </div>
                    <div className="text-left">
                        <p className="text-[11px] font-bold text-white leading-none">Condition</p>
                        <p className="text-[9px] text-slate-500 mt-1">If / Else Logic</p>
                    </div>
                </button>
            </div>
        </section>
    </div>
);

export const FlowBuilder: React.FC = () => {
    const [nodes, setNodes] = React.useState<Node[]>(initialNodes);
    const [edges, setEdges] = React.useState<Edge[]>(initialEdges);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );
    const onConnect: OnConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({
            ...params,
            animated: true,
        }, eds)),
        []
    );

    const addNode = useCallback((type: string) => {
        const id = `${Date.now()}`;
        const newNode: Node = {
            id,
            type,
            position: { x: 250, y: 150 },
            data: {
                label: `New ${type}`,
                config: type === 'payment' ? { amount: '0.1' } : {}
            },
        };
        setNodes((nds) => nds.concat(newNode));
    }, [nodes]);

    React.useEffect(() => {
        const handleAddNode = (event: any) => {
            if (event.detail && event.detail.type) {
                addNode(event.detail.type);
            }
        };

        window.addEventListener('nexops:flow:add-node' as any, handleAddNode);
        return () => {
            window.removeEventListener('nexops:flow:add-node' as any, handleAddNode);
        };
    }, [addNode]);

    return (
        <div className="h-full w-full bg-[#0a0a0c] flex overflow-hidden">
            {/* Left Sidebar - Node Palette (Hidden in Component, moved to Workspace Sidebar) */}
            <div className="hidden w-64 border-r border-white/5 bg-[#0d0d0f] flex-col shrink-0">
                <div className="p-4 border-b border-white/5 bg-white/5">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-nexus-cyan mb-1">NexOps Flow</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Transaction Orchestrator</p>
                </div>

                <FlowPalette onAddNode={addNode} />

                <div className="p-4 border-t border-white/5 bg-black/20">
                    <Button variant="primary" className="w-full text-xs font-bold uppercase tracking-widest py-2.5 h-auto">
                        <Play size={14} className="mr-2" /> Execute Flow
                    </Button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    colorMode="dark"
                    className="bg-[#0a0a0c]"
                >
                    <Background
                        color="#ffffff"
                        gap={20}
                        size={1}
                        variant={BackgroundVariant.Dots}
                        style={{ opacity: 0.1 }}
                    />
                    <Controls />
                    <Panel position="top-right" className="flex gap-2 p-2 bg-[#0d0d0f]/80 backdrop-blur rounded-lg border border-white/10 shadow-2xl">
                        <button className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-nexus-cyan transition-colors" title="Save Flow">
                            <Save size={16} />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-nexus-cyan transition-colors" title="Export JSON">
                            <Download size={16} />
                        </button>
                        <button className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-red-500 transition-colors" onClick={() => { setNodes([]); setEdges([]); }} title="Clear Canvas">
                            <Trash2 size={16} />
                        </button>
                        <div className="w-[1px] h-4 bg-white/10 my-auto mx-1" />
                        <button className="p-2 hover:bg-white/5 rounded text-slate-400 hover:text-white transition-colors" title="Snap to Grid">
                            <Grid3X3 size={16} />
                        </button>
                    </Panel>

                    <Panel position="bottom-left" className="bg-[#0d0d0f]/80 backdrop-blur p-3 rounded-lg border border-white/10 text-[10px] text-slate-500 font-mono">
                        <div className="flex items-center gap-4">
                            <span>Nodes: {nodes.length}</span>
                            <span>Connections: {edges.length}</span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Interactive
                            </span>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
};
