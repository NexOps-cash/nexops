import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import type { WizardDeployRecord } from '../../types';
import { KINDS_BY_ID } from '../../services/wizard/kinds';
import { collectFieldDefs } from '../../services/wizard/schema';
import { getExplorerLink } from '../../services/blockchainService';
import toast from 'react-hot-toast';
import { Modal, Button } from '../UI';
import { formatKindDisplayLabel } from '../../services/wizard/kindDisplay';

const INVARIANT_LABELS: Record<string, string> = {
  OUTPUT_COUNT_CLAMP: 'Max outputs capped',
  OUTPUT_COUNT_GUARD: 'Min outputs enforced',
  VALUE_PRESERVING_COVENANT: 'Value preserved',
  INPUT_OUTPUT_VALUE_MATCH: 'Output value matches spent input',
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

function DeploymentDetailBody({ rec }: { rec: WizardDeployRecord }) {
  const kind = KINDS_BY_ID[rec.kindId];
  const defs = kind ? collectFieldDefs(kind, rec.wizardEnabled ?? {}) : [];
  const labelById = new Map(defs.map((d) => [d.id, d.label]));

  return (
    <div className="space-y-5 text-slate-400">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-white font-medium">{formatRelative(rec.timestamp)}</span>
        <span className="text-slate-500">
          {rec.fundingAmountSats.toLocaleString()} <span className="text-slate-600">sats funded</span>
        </span>
      </div>
      {kind && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 font-semibold mb-1">Template</p>
          <p className="text-base font-semibold text-white">{formatKindDisplayLabel(kind.name)}</p>
          <p className="text-[11px] font-mono text-slate-500">{rec.kindId}</p>
        </div>
      )}

      {rec.invariants.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Guards</p>
          <div className="flex flex-wrap gap-1.5">
            {rec.invariants.map((id) => (
              <span
                key={id}
                className="px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-200/95"
              >
                {INVARIANT_LABELS[id] ?? id}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-white/10 pt-4 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Contract address</p>
          <div className="flex items-start gap-2">
            <span className="font-mono text-[13px] text-emerald-300/95 break-all leading-snug">{rec.contractAddress}</span>
            <button
              type="button"
              className="text-emerald-400 hover:text-emerald-300 shrink-0 mt-0.5"
              aria-label="Copy contract address"
              onClick={() => {
                void navigator.clipboard.writeText(rec.contractAddress);
                toast.success('Copied');
              }}
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {rec.tokenAddress && (
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Token address</p>
            <p className="font-mono text-[13px] text-slate-300 break-all leading-snug">{rec.tokenAddress}</p>
          </div>
        )}

        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Funding transaction</p>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-left"
            onClick={() => window.open(getExplorerLink(rec.fundingTxid), '_blank')}
          >
            <span className="font-mono text-[13px] break-all">{rec.fundingTxid}</span>
            <ExternalLink className="w-4 h-4 shrink-0" />
          </button>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Composer fields</p>
          <ul className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
            {Object.entries(rec.wizardFieldSnapshot).map(([fid, val]) => (
              <li key={fid} className="text-[13px] leading-snug">
                <span className="text-slate-500">{labelById.get(fid) ?? fid}:</span>{' '}
                <span className="font-mono text-slate-200">{String(val)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 font-semibold mb-2">Constructor arguments</p>
          <ul className="space-y-1.5 font-mono text-[12px]">
            {rec.artifact.constructorInputs.map((inp, i) => (
              <li key={inp.name} className="leading-snug">
                <span className="text-slate-500">{inp.name}:</span>{' '}
                <span className="text-slate-200 break-all">{rec.constructorArgs[i] ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface DeployHistoryPanelProps {
  kindId: string;
  records: WizardDeployRecord[];
  /** Open chipnet spend / Transaction Builder for a saved deployment. */
  onRequestSpend?: (rec: WizardDeployRecord) => void;
}

export const DeployHistoryPanel: React.FC<DeployHistoryPanelProps> = ({ kindId, records, onRequestSpend }) => {
  const [detailRecord, setDetailRecord] = useState<WizardDeployRecord | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() => records.filter((r) => r.kindId === kindId), [records, kindId]);

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 w-full h-full max-h-52 xl:max-h-none bg-black/20">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-emerald-300"
      >
        <span>Deployments ({filtered.length})</span>
        <span>{collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>
      {!collapsed && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain custom-scrollbar p-2 space-y-2 w-full">
          {filtered.length === 0 ? (
            <p className="text-[10px] text-slate-600 px-2">No wizard deployments for this template yet.</p>
          ) : (
            filtered.map((rec) => (
              <button
                key={rec.id}
                type="button"
                className="w-full text-left rounded border border-white/10 bg-[#070b09] px-2 py-2 hover:bg-white/5 hover:border-white/15 transition-colors"
                onClick={() => setDetailRecord(rec)}
              >
                <div className="flex items-center gap-1 text-[10px] text-slate-500">{formatRelative(rec.timestamp)}</div>
                <div className="text-[10px] font-mono text-emerald-300/90 truncate mt-0.5">{rec.contractAddress}</div>
                <div className="text-[9px] text-slate-600">{rec.fundingAmountSats.toLocaleString()} sats</div>
              </button>
            ))
          )}
        </div>
      )}
      <Modal
        isOpen={detailRecord !== null}
        onClose={() => setDetailRecord(null)}
        title="Deployment details"
        className="max-w-lg border-emerald-500/15"
      >
        {detailRecord ? (
          <>
            <DeploymentDetailBody rec={detailRecord} />
            {onRequestSpend ? (
              <div className="mt-5 pt-4 border-t border-white/10 space-y-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onRequestSpend(detailRecord);
                    setDetailRecord(null);
                  }}
                >
                  Call function
                </Button>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Spend paths use the same signing setup as deploy — NexOps test identity or WalletConnect when keys live in
                  Paytaca.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
};
