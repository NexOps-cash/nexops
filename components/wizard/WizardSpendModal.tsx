import React, { useMemo } from 'react';
import type { WizardDeployRecord } from '../../types';
import { TransactionBuilder } from '../TransactionBuilder';
import { Modal } from '../UI';
import { useWallet } from '../../contexts/WalletContext';
import { walletConnectService } from '../../services/walletConnectService';
import { buildProjectFromWizardDeployRecord } from '../../services/wizard/wizardDeployRecordProject';

export interface WizardSpendModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: WizardDeployRecord | null;
}

/**
 * Full Transaction Builder experience for a saved wizard deployment (Chipnet templates tested in CLI).
 */
export const WizardSpendModal: React.FC<WizardSpendModalProps> = ({ isOpen, onClose, record }) => {
    const { getWalletById, activeWallet } = useWallet();

    const project = useMemo(() => (record ? buildProjectFromWizardDeployRecord(record) : null), [record]);

    const identityWallet = useMemo(() => {
        if (!record?.deployIdentityWalletId) return activeWallet;
        return getWalletById(record.deployIdentityWalletId) ?? activeWallet;
    }, [record, activeWallet, getWalletById]);

    if (!isOpen) {
        return null;
    }

    if (!record) {
        return null;
    }

    if (!project?.deployedArtifact) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Call contract function" className="max-w-lg">
                <p className="text-sm text-slate-400">
                    Cannot load spend UI — unknown template or this deployment cannot be reconstructed from saved fields.
                </p>
            </Modal>
        );
    }

    const wcSession = walletConnectService.getSession();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Call contract function"
            className="max-w-5xl w-[min(100vw-1.5rem,56rem)] max-h-[92vh] flex flex-col border-emerald-500/15"
        >
            <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">
                <div className="shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-950/25 px-3 py-2.5 text-[11px] text-slate-200 leading-relaxed space-y-2">
                    <p>
                        <span className="font-semibold text-emerald-300">Use the correct signing wallet</span> — match how you
                        configured keys under <span className="text-slate-300">Deploy identity context</span> when you
                        deployed.
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                        <li>
                            If keys are in NexOps: choose signing method <strong className="text-slate-300">Burner</strong> and
                            select{' '}
                            <strong className="font-mono text-emerald-300">
                                {record.deployIdentityWalletName ?? identityWallet?.name ?? 'your deploy identity'}
                            </strong>
                            .
                        </li>
                        <li>
                            If keys live only in Paytaca or another app: connect{' '}
                            <strong className="text-slate-300">WalletConnect</strong> and sign there (same keys as in your
                            constructor args).
                        </li>
                        <li className="text-slate-500">
                            Funding used the QR / external send screen — spending unlocks covenant paths with signatures from
                            those identity keys.
                        </li>
                    </ul>
                    {!record.deployIdentityWalletId ? (
                        <p className="text-amber-200/90 border-t border-amber-500/20 pt-2 mt-1">
                            This deployment was saved before identity tracking. Pick the wallet that matches your constructor
                            pubkeys manually.
                        </p>
                    ) : null}
                </div>

                <div className="flex-1 min-h-[420px] overflow-y-auto overscroll-y-contain custom-scrollbar rounded-lg border border-white/10 bg-[#0d1425]/80">
                    <TransactionBuilder
                        artifact={record.artifact}
                        deployedAddress={record.contractAddress}
                        constructorArgs={record.constructorArgs}
                        wcSession={wcSession}
                        network="chipnet"
                        project={project}
                        burnerWif={identityWallet?.wif}
                        burnerAddress={identityWallet?.address}
                        burnerPubkey={identityWallet?.pubkey}
                        history={[]}
                    />
                </div>
            </div>
        </Modal>
    );
};
