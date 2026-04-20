import React from 'react';
import { ContractKind } from '../../services/wizard/schema';

interface KindTabsProps {
  kinds: ContractKind[];
  activeKindId: string;
  onSelect: (id: string) => void;
}

export const KindTabs: React.FC<KindTabsProps> = ({ kinds, activeKindId, onSelect }) => {
  return (
    <div className="border-b border-white/10 px-4 pt-4">
      <div className="flex items-center gap-2 overflow-x-auto pb-3">
        {kinds.map((kind) => {
          const active = kind.id === activeKindId;
          return (
            <button
              key={kind.id}
              onClick={() => onSelect(kind.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-md border transition-colors whitespace-nowrap ${
                active
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                  : 'border-white/10 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
              title={kind.summary}
            >
              {kind.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
