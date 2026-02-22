import React, { useState } from 'react';
import { Card, Button, Input } from '../components/UI';
import { ChainType, Project, ProjectFile } from '../types';
import { Cpu, ArrowRight, Layers, FileText, Wand2 } from 'lucide-react';
import { generateProjectScaffold } from '../services/groqService';

interface CreateProjectProps {
    onNavigate: () => void;
    onCreateProject: (project: Project) => void;
}

export const CreateProject: React.FC<CreateProjectProps> = ({ onNavigate, onCreateProject }) => {
    const [name, setName] = useState('');
    const [chain, setChain] = useState<ChainType>(ChainType.BCH_TESTNET);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleCreate = async () => {
        setIsGenerating(true);

        let files: ProjectFile[] = [];

        // Use AI to scaffold if prompt provided, else basic template
        if (prompt) {
            files = await generateProjectScaffold(name, prompt);
        } else {
            files = await generateProjectScaffold(name, "Basic starter contract");
        }

        // Find main contract file to set as contractCode for legacy compat
        const mainFile = files.find(f => f.name.endsWith('.cash')) || files[0];

        const newProject: Project = {
            id: crypto.randomUUID(),
            name: name || 'Untitled Project',
            chain: chain,
            files: files,
            contractCode: mainFile?.content || '',
            versions: [{
                id: 'init',
                timestamp: Date.now(),
                fileName: mainFile?.name || 'contract.cash',
                code: mainFile?.content || '',
                description: 'Initial Commit',
                author: 'AI'
            }],
            lastModified: Date.now(),
            auditReport: undefined
        };

        onCreateProject(newProject);
        // Navigate will be handled by parent activeProjectId change, but explicit safety here
        setIsGenerating(false);
    };

    return (
        <div className="max-w-2xl mx-auto h-full flex items-center justify-center">
            <Card className="w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nexus-cyan to-nexus-purple"></div>

                <div className="flex items-center mb-8">
                    <div className="bg-nexus-800 p-3 rounded-xl border border-nexus-700 mr-4">
                        <Layers className="w-8 h-8 text-nexus-cyan" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Initialize Project</h2>
                        <p className="text-gray-400 text-sm">Create a new workspace for your dApp.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Project Name</label>
                        <Input
                            placeholder="e.g., DeFi Vault V1"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center">
                            <Wand2 className="w-3 h-3 mr-1 text-nexus-purple" /> AI Instructions (Optional)
                        </label>
                        <textarea
                            className="w-full bg-nexus-900/50 border border-nexus-700 rounded-lg p-3 text-gray-300 text-sm h-24 focus:border-nexus-cyan outline-none resize-none"
                            placeholder="Describe your contract logic here to auto-generate the boilerplate..."
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-nexus-700/50">
                        <Button variant="ghost" onClick={() => onNavigate()}>Cancel</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={!name}
                            isLoading={isGenerating}
                            icon={<ArrowRight className="w-4 h-4" />}
                        >
                            Create Workspace
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};