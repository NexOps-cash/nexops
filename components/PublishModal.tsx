import React, { useState } from 'react';
import { Modal, Button, Input } from './UI';
import { ShieldCheck, Info } from 'lucide-react';

interface PublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (details: { title: string; description: string; tags: string[] }) => void;
    initialTitle: string;
    isPublishing: boolean;
}

export const PublishModal: React.FC<PublishModalProps> = ({
    isOpen,
    onClose,
    onPublish,
    initialTitle,
    isPublishing
}) => {
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState('');
    const [tagsStr, setTagsStr] = useState('');

    const handlePublish = () => {
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t !== "");
        onPublish({ title, description, tags });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Publish to Verified Registry"
            className="max-w-md !bg-bch-dark !border-white/10"
        >
            <div className="space-y-6">
                <div className="flex items-start space-x-3 bg-bch-green/10 border border-bch-green/30 p-4 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-bch-green shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] text-bch-green font-black uppercase tracking-[0.2em] mb-1">Ecosystem Audit</p>
                        <p className="text-sm text-white/60 leading-relaxed font-medium">
                            Your contract will be submitted to the Public Registry. Once published, anyone can view and load it into their workspace.
                        </p>
                    </div>
                </div>

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
                    >
                        Publish Now
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
