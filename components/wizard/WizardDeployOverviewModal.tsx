import React from 'react';
import { ShieldCheck, ListChecks, Wallet } from 'lucide-react';
import { Modal, Button } from '../UI';

export interface WizardDeployOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  kindName: string;
  kindId: string;
  summary: string;
  invariantCount: number;
}

/**
 * First-step Chipnet deploy prompt — concise summary before the full deploy wizard opens.
 */
export const WizardDeployOverviewModal: React.FC<WizardDeployOverviewModalProps> = ({
  isOpen,
  onClose,
  onContinue,
  kindName,
  kindId,
  summary,
  invariantCount,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deploy on Chipnet" className="max-w-md">
      <div className="space-y-5 text-slate-300">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 font-semibold">Template</p>
          <p className="text-xl font-semibold text-white tracking-tight leading-snug">{kindName}</p>
          <p className="text-[11px] font-mono text-slate-500">{kindId}</p>
        </div>

        <p className="text-sm text-slate-400 leading-relaxed">{summary}</p>

        <ul className="space-y-3 text-[13px] leading-snug text-slate-400 border-y border-white/10 py-4">
          <li className="flex gap-3">
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <span>
              Fund with <strong className="text-slate-200">Chipnet BCH only</strong>. Mainnet coins cannot activate this contract.
            </span>
          </li>
          <li className="flex gap-3">
            <ListChecks className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <span>
              Flow: review constructor arguments → choose funding → scan QR / send payment → confirmation saved locally.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden />
            <span>
              {invariantCount > 0 ? (
                <>
                  This build declares{' '}
                  <strong className="text-slate-200">{invariantCount}</strong> named structural guard
                  {invariantCount === 1 ? '' : 's'} from the composer (shown again inside deploy).
                </>
              ) : (
                <>Structural checks come from the generated CashScript; you&apos;ll see guards listed during deploy.</>
              )}
            </span>
          </li>
        </ul>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={onContinue}>
            Continue to deploy
          </Button>
        </div>
      </div>
    </Modal>
  );
};
