import React, { useState } from 'react';
import { Modal, Button, Input } from './UI';
import { Key, Globe, Shield, ExternalLink, AlertCircle } from 'lucide-react';
import { BYOKSettings } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: BYOKSettings;
    onSave: (settings: BYOKSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    settings,
    onSave
}) => {
    const [apiKey, setApiKey] = useState(settings.apiKey);
    const [provider, setProvider] = useState(settings.provider);

    const handleSave = () => {
        onSave({ apiKey, provider });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="System Settings"
            className="max-w-md"
        >
            <div className="space-y-6 py-2">
                {/* Header Section */}
                <div className="flex items-center space-x-3 p-3 bg-nexus-cyan/5 border border-nexus-cyan/20 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-nexus-cyan/10 flex items-center justify-center border border-nexus-cyan/20">
                        <Key className="text-nexus-cyan w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">BYOK Integration</h4>
                        <p className="text-[10px] text-slate-400">Bring Your Own Key for AI Operations</p>
                    </div>
                </div>

                {/* Model Provider Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                            <Globe className="w-3 h-3 mr-1.5" />
                            Model Provider
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setProvider('groq')}
                            className={`p-3 rounded-xl border text-center transition-all ${provider === 'groq'
                                    ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                    : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                                }`}
                        >
                            <span className="text-xs font-black uppercase tracking-wider">Groq</span>
                        </button>
                        <button
                            onClick={() => setProvider('openrouter')}
                            className={`p-3 rounded-xl border text-center transition-all ${provider === 'openrouter'
                                    ? 'bg-nexus-cyan/10 border-nexus-cyan text-nexus-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                                    : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/20'
                                }`}
                        >
                            <span className="text-xs font-black uppercase tracking-wider">OpenRouter</span>
                        </button>
                    </div>
                </div>

                {/* API Key Section */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                            <Shield className="w-3 h-3 mr-1.5" />
                            API Key
                        </label>
                        <a
                            href={provider === 'groq' ? "https://console.groq.com/keys" : "https://openrouter.ai/keys"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-black text-nexus-cyan hover:underline flex items-center uppercase tracking-tighter"
                        >
                            Get Key <ExternalLink className="w-2.5 h-2.5 ml-1" />
                        </a>
                    </div>
                    <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Enter your ${provider === 'groq' ? 'Groq' : 'OpenRouter'} API Key`}
                        className="font-mono text-xs"
                    />
                    {apiKey && (
                        <div className="p-2 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mr-2" />
                            <span className="text-[9px] font-bold text-green-500/80 uppercase tracking-widest">BYOK Mode Active</span>
                        </div>
                    )}
                </div>

                {/* Info Note */}
                <div className="p-3 bg-nexus-warning/5 border border-nexus-warning/20 rounded-xl space-y-2">
                    <div className="flex items-center text-nexus-warning text-[10px] font-black uppercase tracking-widest">
                        <AlertCircle className="w-3 h-3 mr-1.5" />
                        Security Note
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                        Keys are stored locally in your browser and sent only for generation and audit requests. They are never saved on NexOps servers.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        variant="ghost"
                        className="flex-1 text-[10px] font-black uppercase tracking-widest"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        className="flex-1 text-[10px] font-black uppercase tracking-widest"
                        onClick={handleSave}
                    >
                        Save Settings
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
