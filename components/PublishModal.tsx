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
            className="max-w-md"
        >
            <div className="space-y-6">
                <div className="flex items-start space-x-3 bg-nexus-cyan/10 border border-nexus-cyan/30 p-4 rounded-lg">
                    <ShieldCheck className="w-5 h-5 text-nexus-cyan shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-nexus-cyan font-bold uppercase tracking-wider mb-1">Ecosystem Audit</p>
                        <p className="text-sm text-slate-300 leading-relaxed">
                            Your contract will be submitted to the Public Registry. Once published, anyone can view and load it into their workspace.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">Contract Title</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. My Secure Multisig"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-nexus-900/50 border border-nexus-700 rounded-lg px-4 py-2 text-gray-200 focus:border-nexus-cyan focus:ring-1 focus:ring-nexus-cyan outline-none transition-colors h-24 resize-none"
                            placeholder="Describe what this contract does..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 uppercase tracking-widest mb-2">Tags (comma separated)</label>
                        <Input
                            value={tagsStr}
                            onChange={(e) => setTagsStr(e.target.value)}
                            placeholder="e.g. multisig, vault, production"
                        />
                        <div className="mt-2 flex items-center text-[10px] text-slate-500">
                            <Info className="w-3 h-3 mr-1" />
                            Helps builders find your contract in the registry.
                        </div>
                    </div>
                </div>

                <div className="flex space-x-3 pt-2">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1"
                        disabled={isPublishing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handlePublish}
                        className="flex-1"
                        isLoading={isPublishing}
                    >
                        Publish Now
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
