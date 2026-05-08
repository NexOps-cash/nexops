import React, { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import type { ContractKind } from '../../services/wizard/schema';
import { formatKindDisplayLabel } from '../../services/wizard/kindDisplay';
import { Button } from '../UI';

export interface WizardTemplatePickerProps {
  kinds: ContractKind[];
  /** Used when the picker opens (e.g. current composer template). */
  initialSelectedKindId: string;
  onContinue: (kindId: string) => void;
}

export const WizardTemplatePicker: React.FC<WizardTemplatePickerProps> = ({
  kinds,
  initialSelectedKindId,
  onContinue,
}) => {
  const [selectedId, setSelectedId] = useState(initialSelectedKindId);

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#050a08]">
      <div className="shrink-0 px-4 sm:px-6 pt-6 pb-4 max-w-7xl mx-auto w-full">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
            <Layers className="w-6 h-6" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">Choose a contract template</h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
              Each template is a Chipnet-ready CashScript starting point. Read what it does, which constructor inputs it needs,
              and which optional modules you can toggle—then continue to configure fields and generate source.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar px-4 sm:px-6 pb-4">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 lg:gap-6">
          {kinds.map((kind) => {
            const selected = kind.id === selectedId;
            const toggleableFeatures = kind.features.filter((f) => !f.disabled);
            const title = formatKindDisplayLabel(kind.name);
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => setSelectedId(kind.id)}
                className={`text-left rounded-2xl border flex flex-col min-h-[300px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050a08] ${
                  selected
                    ? 'border-emerald-400/40 bg-gradient-to-b from-emerald-500/[0.12] to-emerald-950/[0.08] shadow-[0_8px_40px_-12px_rgba(16,185,129,0.35)]'
                    : 'border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent hover:border-white/[0.14] hover:from-white/[0.07]'
                }`}
              >
                <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1 min-h-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-medium">Template</p>
                      <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-snug">{title}</h2>
                      <p className="inline-flex items-center text-[11px] font-mono text-slate-500 bg-black/35 border border-white/[0.06] rounded-lg px-2 py-1 max-w-full truncate">
                        {kind.id}
                      </p>
                    </div>
                    {selected ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-1 drop-shadow-[0_0_8px_rgba(52,211,153,0.45)]" aria-hidden />
                    ) : (
                      <span className="w-6 h-6 rounded-full border-2 border-white/15 shrink-0 mt-1 opacity-60" aria-hidden />
                    )}
                  </div>

                  <p className="text-[15px] text-slate-400 leading-relaxed">{kind.summary}</p>

                  <div className="flex-1 min-h-0 flex flex-col gap-4 pt-2 border-t border-white/[0.08]">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-400/85 font-semibold mb-3">
                        Constructor inputs
                      </p>
                      <ul className="space-y-2.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                        {kind.fields.map((f) => (
                          <li key={f.id} className="text-[13px] leading-relaxed text-slate-400 pl-3 border-l-2 border-emerald-500/20">
                            <span className="text-slate-100 font-medium">{f.label}</span>
                            <span className="text-slate-600"> — </span>
                            <span>{f.description}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {toggleableFeatures.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-400/85 font-semibold mb-3">
                          Optional modules
                        </p>
                        <ul className="space-y-2.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                          {toggleableFeatures.map((feat) => (
                            <li key={feat.id} className="text-[13px] leading-relaxed text-slate-400 pl-3 border-l-2 border-white/[0.12]">
                              <span className="text-slate-100 font-medium">{feat.label}</span>
                              <span className="text-slate-600"> — </span>
                              <span>{feat.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.08] bg-black/40 backdrop-blur-sm px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto w-full flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
          <Button variant="primary" size="md" className="w-full sm:w-auto" onClick={() => onContinue(selectedId)}>
            Continue to composer
          </Button>
        </div>
      </div>
    </div>
  );
};
