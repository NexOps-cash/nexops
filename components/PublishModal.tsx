import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input } from './UI';
import { ShieldCheck, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { PublishEligibilityResult } from '../lib/registryGate';
import {
  deriveValidationStatus,
  deriveVisibility,
  formatRejectionReason,
  VERIFIED_SCORE,
  MIN_PUBLISH_SCORE,
} from '../lib/registryGate';
import type { AuditReport } from '../types';

interface PublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (details: { title: string; description: string; tags: string[]; intentDescription: string }) => void;
    initialTitle: string;
    initialIntent?: string;
    isPublishing: boolean;
    eligibility: PublishEligibilityResult | null;
    auditReport?: AuditReport;
}

export const PublishModal: React.FC<PublishModalProps> = ({
    isOpen,
    onClose,
    onPublish,
    initialTitle,
    initialIntent = '',
    isPublishing,
    eligibility,
    auditReport,
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState('');
    const [intentDescription, setIntentDescription] = useState(initialIntent);
    const [tagsStr, setTagsStr] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setTitle(initialTitle);
        setDescription('');
        setIntentDescription(initialIntent);
        setTagsStr('');
    }, [isOpen, initialTitle, initialIntent]);

    const preview = useMemo(() => {
        if (!auditReport || !eligibility?.eligible) return null;
        const status = deriveValidationStatus(auditReport);
        const visibility = deriveVisibility(eligibility.auditScore, auditReport.vulnerabilities ?? []);
        return { status, visibility };
    }, [auditReport, eligibility]);

    const handlePublish = () => {
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t !== "");
        onPublish({ title, description, tags, intentDescription });
    };

    const canPublish = eligibility?.eligible === true && !isPublishing;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Publish to Registry"
            className="max-w-md !bg-bch-dark !border-white/10"
        >
            <div className="space-y-6">
                <div className="flex items-start space-x-3 bg-bch-green/10 border border-bch-green/30 p-4 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-bch-green shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] text-bch-green font-black uppercase tracking-[0.2em] mb-1">Registry Trust Layer</p>
                        <p className="text-sm text-white/60 leading-relaxed font-medium">
                            Registry presence does not imply endorsement. Validated contracts pass the audit gate; unsafe entries are visible for community review only.
                        </p>
                    </div>
                </div>

                {eligibility && (
                    <div className={`p-4 rounded-xl border ${eligibility.eligible ? 'bg-white/5 border-white/10' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Audit score</span>
                            <span className={`text-lg font-mono font-bold ${eligibility.auditScore >= MIN_PUBLISH_SCORE ? 'text-bch-green' : 'text-red-400'}`}>
                                {eligibility.auditScore}
                            </span>
                        </div>
                        {!eligibility.eligible && (
                            <ul className="space-y-1 mt-3">
                                {eligibility.rejectionReasons.map((r) => (
                                    <li key={r} className="text-xs text-red-300 flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {formatRejectionReason(r)}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {preview && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${preview.status === 'validated' ? 'bg-bch-green/20 text-bch-green' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {preview.status === 'validated' ? 'Validated' : 'Unsafe'}
                                </span>
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${preview.visibility === 'verified' ? 'bg-bch-green/20 text-bch-green' : 'bg-white/10 text-white/60'}`}>
                                    {preview.visibility === 'verified' ? `Verified (${VERIFIED_SCORE}+)` : 'Community'}
                                </span>
                            </div>
                        )}
                        {preview?.status === 'unsafe' && (
                            <p className="text-xs text-amber-200/80 mt-3 flex items-start gap-2">
                                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                This contract will be published as unsafe — visible for transparency, not endorsed.
                            </p>
                        )}
                    </div>
                )}

                <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2">Contract Title</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. My Secure Multisig"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-bch-green/50 focus:ring-1 focus:ring-bch-green/20 outline-none transition-all placeholder:text-white/10 font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-bch-green/50 focus:ring-1 focus:ring-bch-green/20 outline-none transition-all h-24 resize-none placeholder:text-white/10 font-medium"
                            placeholder="Describe what this contract does..."
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2">Intent description</label>
                        <textarea
                            value={intentDescription}
                            onChange={(e) => setIntentDescription(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-bch-green/50 focus:ring-1 focus:ring-bch-green/20 outline-none transition-all h-20 resize-none placeholder:text-white/10 font-medium"
                            placeholder="What was this contract designed to do?"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2">Tags (comma separated)</label>
                        <Input
                            value={tagsStr}
                            onChange={(e) => setTagsStr(e.target.value)}
                            placeholder="e.g. multisig, vault, production"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-bch-green/50 focus:ring-1 focus:ring-bch-green/20 outline-none transition-all placeholder:text-white/10 font-medium"
                        />
                        <div className="mt-2 flex items-center text-[10px] font-bold text-white uppercase tracking-[0.05em]">
                            <Info className="w-3.5 h-3.5 mr-1.5 text-bch-green opacity-50" />
                            Helps builders find your contract in the registry.
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3 pt-4">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 !bg-white/5 !text-white/40 !border-white/10 hover:!border-bch-green/30 hover:!text-white !rounded-xl !h-12 !font-black !uppercase !text-[11px] !tracking-widest"
                        disabled={isPublishing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handlePublish}
                        className="flex-1 !bg-bch-green !text-bch-dark !border-none hover:opacity-90 !rounded-xl !h-12 !font-black !uppercase !text-[11px] !tracking-widest shadow-[0_10px_30px_rgba(0,216,85,0.2)]"
                        isLoading={isPublishing}
                        disabled={!canPublish}
                    >
                        Publish Now
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
