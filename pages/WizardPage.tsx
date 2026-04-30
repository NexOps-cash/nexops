import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import toast from 'react-hot-toast';
import { Button } from '../components/UI';
import { Wand2 } from 'lucide-react';
import { Project, ChainType } from '../types';
import { KINDS, KINDS_BY_ID } from '../services/wizard/kinds';
import {
    BuildOptions,
    ContractKind,
    FieldDef,
    defaultValueForField,
    validateAllFields,
} from '../services/wizard/schema';
import { generate } from '../services/wizard/generator';
import { compileCashScript } from '../services/compilerService';
import { KindTabs } from '../components/wizard/KindTabs';
import { FeaturePanel } from '../components/wizard/FeaturePanel';
import { CodePreview } from '../components/wizard/CodePreview';
import { ActionsBar } from '../components/wizard/ActionsBar';

interface WizardPageProps {
    onNavigateHome: () => void;
    onCreateProject: (project: Project) => void;
}

const HASH_KEY = 'nxw=';

interface WizardState {
    kindId: string;
    fields: Record<string, string | number | boolean>;
    enabled: Record<string, boolean>;
}

function base64UrlEncode(text: string): string {
    return btoa(unescape(encodeURIComponent(text)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
    const pad = text.length % 4 ? '='.repeat(4 - (text.length % 4)) : '';
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return decodeURIComponent(escape(atob(normalized)));
}

function initialStateForKind(kind: ContractKind): WizardState {
    const fields: Record<string, string | number | boolean> = {};
    const enabled: Record<string, boolean> = {};
    kind.fields.forEach((field) => {
        fields[field.id] = defaultValueForField(field);
    });
    kind.features.forEach((feature) => {
        enabled[feature.id] = false;
        (feature.fields ?? []).forEach((field) => {
            fields[field.id] = defaultValueForField(field);
        });
    });
    return { kindId: kind.id, fields, enabled };
}

function loadStateFromHash(): WizardState | null {
    const hash = window.location.hash || '';
    const idx = hash.indexOf(HASH_KEY);
    if (idx === -1) return null;
    try {
        const encoded = hash.slice(idx + HASH_KEY.length);
        const decoded = base64UrlDecode(encoded);
        const parsed = JSON.parse(decoded) as WizardState;
        if (!parsed.kindId || !KINDS_BY_ID[parsed.kindId]) return null;
        return parsed;
    } catch {
        return null;
    }
}

export const WizardPage: React.FC<WizardPageProps> = ({ onNavigateHome, onCreateProject }) => {
    const defaultKind = KINDS[0];
    const [wizardState, setWizardState] = useState<WizardState>(() => loadStateFromHash() ?? initialStateForKind(defaultKind));
    const [compileOutput, setCompileOutput] = useState<string>('Compile output will appear here.');
    const [isCompiling, setIsCompiling] = useState(false);
    const [debouncedBuild, setDebouncedBuild] = useState<BuildOptions>({
        fields: wizardState.fields,
        enabled: wizardState.enabled,
    });

    const activeKind = KINDS_BY_ID[wizardState.kindId] ?? defaultKind;

    useEffect(() => {
        const t = window.setTimeout(() => {
            setDebouncedBuild({ fields: wizardState.fields, enabled: wizardState.enabled });
        }, 120);
        return () => window.clearTimeout(t);
    }, [wizardState.fields, wizardState.enabled]);

    const generated = useMemo(
        () => generate(activeKind, debouncedBuild),
        [activeKind, debouncedBuild]
    );
    const fieldErrors = useMemo(
        () => validateAllFields(activeKind, wizardState.enabled, wizardState.fields),
        [activeKind, wizardState.enabled, wizardState.fields]
    );
    const canAct = Object.keys(fieldErrors).length === 0 && generated.constraintErrors.length === 0;

    const handleSelectKind = (kindId: string) => {
        const kind = KINDS_BY_ID[kindId];
        if (!kind) return;
        setWizardState(initialStateForKind(kind));
        setCompileOutput('Compile output will appear here.');
    };

    const handleToggleFeature = (featureId: string) => {
        const feature = activeKind.features.find((f) => f.id === featureId);
        if (!feature || feature.disabled) return;
        setWizardState((prev) => {
            const nextEnabled = { ...prev.enabled, [featureId]: !prev.enabled[featureId] };
            if (nextEnabled[featureId]) {
                for (const conflict of feature.conflicts ?? []) nextEnabled[conflict] = false;
            }
            return { ...prev, enabled: nextEnabled };
        });
    };

    const handleFieldChange = (field: FieldDef, value: string | number | boolean) => {
        setWizardState((prev) => ({
            ...prev,
            fields: { ...prev.fields, [field.id]: value },
        }));
    };

    const createProjectFromCode = (code: string) => {
        const name = `${activeKind.name} Instance`;
        const artifact = compileCashScript(code);
        const files: Project['files'] = [
            { name: 'contract.cash', content: code, language: 'cashscript' },
            {
                name: 'artifact.json',
                content: JSON.stringify(
                    artifact.success ? artifact.artifact : { errors: artifact.errors },
                    null,
                    2
                ),
                language: 'json',
            },
        ];
        const project: Project = {
            id: crypto.randomUUID(),
            name,
            chain: ChainType.BCH_TESTNET,
            contractCode: code,
            files,
            versions: [
                {
                    id: 'init',
                    timestamp: Date.now(),
                    fileName: 'contract.cash',
                    code,
                    description: `Generated from ${activeKind.name} composer`,
                    author: 'SYSTEM',
                },
            ],
            lastModified: Date.now(),
        };
        onCreateProject(project);
    };

    const onCopy = async () => {
        await navigator.clipboard.writeText(generated.source);
        toast.success('Source copied');
    };

    const onDownload = async () => {
        const zip = new JSZip();
        zip.file('contract.cash', generated.source);
        zip.file('metadata.json', JSON.stringify({
            kindId: activeKind.id,
            fields: wizardState.fields,
            enabled: wizardState.enabled,
            hash: generated.hash,
            warnings: generated.warnings,
        }, null, 2));
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeKind.id}-wizard.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const onShare = async () => {
        const payload: WizardState = {
            kindId: activeKind.id,
            fields: wizardState.fields,
            enabled: wizardState.enabled,
        };
        const encoded = base64UrlEncode(JSON.stringify(payload));
        const link = `${window.location.origin}${window.location.pathname}#${HASH_KEY}${encoded}`;
        await navigator.clipboard.writeText(link);
        window.history.replaceState({}, '', `#${HASH_KEY}${encoded}`);
        toast.success('Share link copied');
    };

    const onCompile = async () => {
        setIsCompiling(true);
        try {
            const out = compileCashScript(generated.source);
            if (out.success && out.artifact) {
                setCompileOutput(
                    [
                        'Compile: PASS',
                        `Contract: ${out.artifact.contractName}`,
                        `Bytecode length: ${out.artifact.bytecode.length}`,
                    ].join('\n')
                );
            } else {
                setCompileOutput(['Compile: FAIL', ...(out.errors ?? ['Unknown error'])].join('\n'));
            }
        } finally {
            setIsCompiling(false);
        }
    };

    const onOpenWorkspace = () => createProjectFromCode(generated.source);

    return (
        <div className="h-full w-full bg-[#050a08] overflow-auto p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                            <Wand2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">NexWizard UTXO Composer</h1>
                            <p className="text-slate-500 text-xs">OpenZeppelin-style feature composer for BCH CashScript</p>
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onNavigateHome}>Exit Wizard</Button>
                </div>

                <div className="border border-white/10 rounded-lg bg-black/20 overflow-hidden">
                    <KindTabs kinds={KINDS} activeKindId={activeKind.id} onSelect={handleSelectKind} />
                    <div className="grid grid-cols-1 lg:grid-cols-[360px,1fr] min-h-[700px]">
                        <div className="border-r border-white/10">
                            <FeaturePanel
                                kind={activeKind}
                                values={wizardState.fields}
                                enabled={wizardState.enabled}
                                errors={fieldErrors}
                                onToggle={handleToggleFeature}
                                onFieldChange={handleFieldChange}
                            />
                        </div>
                        <div className="p-4 space-y-4">
                            {generated.constraintErrors.length > 0 && (
                                <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs space-y-1">
                                    {generated.constraintErrors.map((e) => <div key={e}>- {e}</div>)}
                                </div>
                            )}
                            <ActionsBar
                                copyDisabled={false}
                                compileDisabled={isCompiling}
                                downloadDisabled={!canAct}
                                shareDisabled={!canAct}
                                openDisabled={!canAct}
                                onCopy={onCopy}
                                onDownload={onDownload}
                                onShare={onShare}
                                onCompile={onCompile}
                                onOpenWorkspace={onOpenWorkspace}
                            />
                            <CodePreview code={generated.source} hash={generated.hash} warnings={generated.warnings} />
                            <div className="rounded-md border border-white/10 bg-black/20 p-3">
                                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-2">
                                    Compile Output {isCompiling ? '(running...)' : ''}
                                </div>
                                <pre className="text-xs text-slate-300 whitespace-pre-wrap">{compileOutput}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
