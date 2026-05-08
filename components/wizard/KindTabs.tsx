import React from 'react';
import { ContractKind } from '../../services/wizard/schema';
import { formatKindDisplayLabel } from '../../services/wizard/kindDisplay';

interface KindTabsProps {
  kinds: ContractKind[];
  activeKindId: string;
  onSelect: (id: string) => void;
  /** Shown before the scrolling tab row (e.g. link back to template gallery). */
  leadingControls?: React.ReactNode;
}

export const KindTabs: React.FC<KindTabsProps> = ({ kinds, activeKindId, onSelect, leadingControls }) => {
  return (
    <div className="border-b border-white/10 px-4 sm:px-5 pt-4 bg-gradient-to-b from-black/30 to-transparent">
      <div className="flex items-end gap-3 sm:gap-4 overflow-hidden">
        {leadingControls != null ? <div className="shrink-0 pb-3.5 flex items-center">{leadingControls}</div> : null}
        <div className="flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-3.5 flex-1 min-w-0 [scrollbar-width:thin]">
          {kinds.map((kind) => {
            const active = kind.id === activeKindId;
            const label = formatKindDisplayLabel(kind.name);
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => onSelect(kind.id)}
                className={`shrink-0 px-4 py-2.5 text-sm font-medium tracking-normal rounded-xl border transition-all duration-200 whitespace-normal text-center max-w-[11rem] sm:max-w-[13rem] leading-snug ${
                  active
                    ? 'border-emerald-400/45 bg-emerald-500/[0.14] text-emerald-50 shadow-[0_0_20px_-8px_rgba(52,211,153,0.35)]'
                    : 'border-white/[0.09] bg-white/[0.03] text-slate-400 hover:text-slate-100 hover:border-white/[0.14] hover:bg-white/[0.06]'
                }`}
                title={`${label}. ${kind.summary}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
