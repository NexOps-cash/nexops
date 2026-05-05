import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import type { WizardDeployRecord } from '../../types';
import { KINDS_BY_ID } from '../../services/wizard/kinds';
import { collectFieldDefs } from '../../services/wizard/schema';
import { getExplorerLink } from '../../services/blockchainService';
import toast from 'react-hot-toast';

const INVARIANT_LABELS: Record<string, string> = {
  OUTPUT_COUNT_CLAMP: 'Max outputs capped',
  OUTPUT_COUNT_GUARD: 'Min outputs enforced',
  VALUE_PRESERVING_COVENANT: 'Value preserved',
  BOUND_RECIPIENT: 'Locked recipient',
  TOKEN_CATEGORY_CONTINUITY: 'Token category locked',
  DISTINCT_PUBKEYS: 'Distinct keys enforced',
};

function formatRelative(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface DeployHistoryPanelProps {
  kindId: string;
  records: WizardDeployRecord[];
}

export const DeployHistoryPanel: React.FC<DeployHistoryPanelProps> = ({ kindId, records }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() => records.filter((r) => r.kindId === kindId), [records, kindId]);

  return (
    <div className="flex flex-col border-t xl:border-t-0 xl:border-l border-white/10 bg-black/20 min-w-0 min-h-0 h-full max-h-52 xl:max-h-none shrink-0 xl:w-72 xl:h-full">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-emerald-300"
      >
        <span>Deployments ({filtered.length})</span>
        <span>{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2 w-72">
          {filtered.length === 0 ? (
            <p className="text-[10px] text-slate-600 px-2">No wizard deployments for this template yet.</p>
          ) : (
            filtered.map((rec) => {
              const open = expandedId === rec.id;
              const kind = KINDS_BY_ID[rec.kindId];
              const defs = kind ? collectFieldDefs(kind, rec.wizardEnabled ?? {}) : [];
              const labelById = new Map(defs.map((d) => [d.id, d.label]));

              return (
                <div key={rec.id} className="rounded border border-white/10 bg-[#070b09] overflow-hidden">
                  <button
                    type="button"
                    className="w-full text-left px-2 py-2 hover:bg-white/5"
                    onClick={() => setExpandedId(open ? null : rec.id)}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">{formatRelative(rec.timestamp)}</div>
                    <div className="text-[10px] font-mono text-emerald-300/90 truncate mt-0.5">{rec.contractAddress}</div>
                    <div className="text-[9px] text-slate-600">{rec.fundingAmountSats.toLocaleString()} sats</div>
                  </button>
                  {open && (
                    <div className="border-t border-white/10 px-2 py-2 space-y-2 text-[10px] text-slate-400">
                      <div className="flex flex-wrap gap-1">
                        {rec.invariants.map((id) => (
                          <span key={id} className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-200/90">
                            {INVARIANT_LABELS[id] ?? id}
                          </span>
                        ))}
                      </div>
                      <div>
                        <span className="text-slate-600 uppercase font-black">Contract</span>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="font-mono text-xs text-slate-300 break-all">{rec.contractAddress}</span>
                          <button
                            type="button"
                            className="text-emerald-400 shrink-0"
                            onClick={() => {
                              void navigator.clipboard.writeText(rec.contractAddress);
                              toast.success('Copied');
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {rec.tokenAddress && (
                        <div>
                          <span className="text-slate-600 uppercase font-black">Token</span>
                          <p className="font-mono text-xs text-slate-300 break-all mt-1">{rec.tokenAddress}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-600 uppercase font-black">Funding tx</span>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-emerald-400 mt-1"
                          onClick={() => window.open(getExplorerLink(rec.fundingTxid), '_blank')}
                        >
                          <span className="font-mono truncate">{rec.fundingTxid.slice(0, 18)}…</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                      </div>
                      <div>
                        <span className="text-slate-600 uppercase font-black">Composer fields</span>
                        <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                          {Object.entries(rec.wizardFieldSnapshot).map(([fid, val]) => (
                            <li key={fid}>
                              <span className="text-slate-500">{labelById.get(fid) ?? fid}:</span>{' '}
                              <span className="font-mono text-slate-300">{String(val)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="text-slate-600 uppercase font-black">Constructor args</span>
                        <ul className="mt-1 space-y-0.5 font-mono text-[9px]">
                          {rec.artifact.constructorInputs.map((inp, i) => (
                            <li key={inp.name}>
                              {inp.name}: <span className="text-slate-300">{rec.constructorArgs[i] ?? ''}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
