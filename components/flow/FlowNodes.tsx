import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
    User, Send, Zap, GitBranch,
    Shield, Wallet, Database, MoreHorizontal
} from 'lucide-react';

const NodeContainer: React.FC<{
    selected?: boolean;
    borderColor: string;
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}> = ({ selected, borderColor, icon, title, children }) => (
    <div className={`
        min-w-[200px] bg-[#0d0d0f]/90 backdrop-blur-md rounded-xl border-2 transition-all 
        ${selected ? 'shadow-[0_0_20px_rgba(6,182,212,0.2)]' : 'shadow-xl'}
    `} style={{ borderColor: selected ? 'var(--nexus-cyan)' : borderColor }}>
        <div className="flex items-center gap-2 p-3 border-b border-white/5 bg-white/5 rounded-t-xl">
            <div className="p-1.5 rounded-md" style={{ backgroundColor: `${borderColor}20`, color: borderColor }}>
                {icon}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{title}</span>
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
);

export const AccountNode = ({ data, selected }: any) => (
    <div className="relative">
        <NodeContainer
            selected={selected}
            borderColor="#3b82f6"
            icon={<Wallet size={14} />}
            title="Account"
        >
            <div className="space-y-2">
                <p className="text-[10px] text-slate-400 leading-tight">
                    {data.label || 'Primary Funding Account'}
                </p>
                <div className="bg-black/40 rounded p-2 border border-white/5">
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter mb-1">Source</p>
                    <p className="text-[10px] font-mono text-blue-400 truncate">
                        {data.config?.address || 'p2pkh:qr8...'}
                    </p>
                </div>
            </div>
        </NodeContainer>
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500 border-2 border-[#0a0a0c]" />
    </div>
);

export const PaymentNode = ({ data, selected }: any) => (
    <div className="relative">
        <NodeContainer
            selected={selected}
            borderColor="#10b981"
            icon={<Send size={14} />}
            title="Payment"
        >
            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">Amount</span>
                    <span className="text-xs font-mono text-green-400 font-bold">{data.config?.amount || '0'} BCH</span>
                </div>
                <div className="bg-black/40 rounded p-2 border border-white/5">
                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter mb-1">To Address</p>
                    <p className="text-[10px] font-mono text-slate-300 truncate">
                        {data.config?.destination || 'None'}
                    </p>
                </div>
            </div>
        </NodeContainer>
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-green-500 border-2 border-[#0a0a0c]" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500 border-2 border-[#0a0a0c]" />
    </div>
);

export const ContractCallNode = ({ data, selected }: any) => (
    <div className="relative">
        <NodeContainer
            selected={selected}
            borderColor="#f59e0b"
            icon={<Zap size={14} />}
            title="Contract Call"
        >
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Shield size={12} className="text-yellow-500" />
                    <span className="text-[11px] font-bold text-white truncate">
                        {data.config?.contractName || 'Unnamed Contract'}
                    </span>
                </div>
                <div className="bg-black/40 rounded p-2 border border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono italic">
                        {data.config?.functionName || 'None'}
                    </span>
                </div>
            </div>
        </NodeContainer>
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-yellow-500 border-2 border-[#0a0a0c]" />
        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-yellow-500 border-2 border-[#0a0a0c]" />
    </div>
);

export const LogicNode = ({ data, selected }: any) => (
    <div className="relative">
        <NodeContainer
            selected={selected}
            borderColor="#8b5cf6"
            icon={<GitBranch size={14} />}
            title="Condition"
        >
            <div className="bg-black/40 rounded p-2 border border-white/5 text-center">
                <p className="text-[10px] text-purple-400 font-bold">
                    {data.config?.condition || 'IF BALANCE > 0'}
                </p>
            </div>
        </NodeContainer>
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-purple-500 border-2 border-[#0a0a0c]" />
        <Handle type="source" position={Position.Right} id="true" style={{ top: '30%' }} className="w-3 h-3 bg-purple-500 border-2 border-[#0a0a0c]" />
        <Handle type="source" position={Position.Right} id="false" style={{ top: '70%' }} className="w-3 h-3 bg-red-500 border-2 border-[#0a0a0c]" />
        <div className="absolute right-[-18px] top-[26%] text-[8px] font-bold text-green-500">YES</div>
        <div className="absolute right-[-15px] top-[66%] text-[8px] font-bold text-red-500">NO</div>
    </div>
);
