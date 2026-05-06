import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import toast from 'react-hot-toast';
import { Project, ChainType, WizardDeployRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  consumeWizardPendingAction,
  isLocalhostRuntime,
  loginSafeReturnHref,
  persistAuthReturnIfAbsent,
  resetHasHandledAuthBeforeLoginRedirect,
  setWizardPendingAction,
} from '../lib/authRouting';
import { KINDS, KINDS_BY_ID } from '../services/wizard/kinds';
import {
  BuildOptions,
  ContractKind,
  FieldDef,
  collectFieldDefs,
  defaultValueForField,
  normalizeValue,
  validateAllFields,
  validateFieldValue,
} from '../services/wizard/schema';
import { generate } from '../services/wizard/generator';
import { compileCashScript } from '../services/compilerService';
import { KindTabs } from '../components/wizard/KindTabs';
import { FeaturePanel } from '../components/wizard/FeaturePanel';
import { CodePreview } from '../components/wizard/CodePreview';
import { ActionsBar } from '../components/wizard/ActionsBar';
import { WizardDeployPanel } from '../components/wizard/WizardDeployPanel';
import { DeployHistoryPanel } from '../components/wizard/DeployHistoryPanel';
import { getWizardDeploys } from '../lib/wizardDeployStore';

interface WizardPageProps {
  onCreateProject: (project: Project) => void;
}

const HASH_FRAGMENT_PREFIX = 'nxw=';

const ALLOWED_ROOT = new Set(['kindId', 'fields', 'enabled']);

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

function readNxwEncodedFromHash(): string | null {
  const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const params = new URLSearchParams(raw || '');
  const nxw = params.get('nxw');
  if (!nxw || nxw.length > 5000) return null;
  return nxw;
}

/** Strict #nxw= payload validation — enabled first, then fieldDefs, then fields. */
function validateWizardPayload(obj: unknown): WizardState | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const record = obj as Record<string, unknown>;
  const rootKeys = Object.keys(record);
  if (!rootKeys.every((k) => ALLOWED_ROOT.has(k))) return null;

  const kindId = record.kindId;
  if (typeof kindId !== 'string' || !KINDS_BY_ID[kindId]) return null;
  const kind = KINDS_BY_ID[kindId];

  const enabledRaw = record.enabled;
  if (!enabledRaw || typeof enabledRaw !== 'object' || Array.isArray(enabledRaw)) return null;
  const enabledIn = enabledRaw as Record<string, unknown>;
  const featureIds = new Set(kind.features.map((f) => f.id));
  for (const key of Object.keys(enabledIn)) {
    if (!featureIds.has(key)) return null;
    if (typeof enabledIn[key] !== 'boolean') return null;
  }

  const enabled: Record<string, boolean> = {};
  kind.features.forEach((f) => {
    enabled[f.id] = enabledIn[f.id] === true;
  });

  const fieldsRaw = record.fields;
  if (!fieldsRaw || typeof fieldsRaw !== 'object' || Array.isArray(fieldsRaw)) return null;
  const fieldsIn = fieldsRaw as Record<string, unknown>;

  const fieldDefs = collectFieldDefs(kind, enabled);
  const allowedIds = new Set(fieldDefs.map((f) => f.id));
  for (const key of Object.keys(fieldsIn)) {
    if (!allowedIds.has(key)) return null;
  }

  const base = initialStateForKind(kind);
  for (const def of fieldDefs) {
    const val = fieldsIn[def.id];
    if (val === undefined) continue;
    if (val === null || typeof val === 'object') return null;
    const vr = validateFieldValue(def, val);
    if (!vr.valid) return null;
    base.fields[def.id] = normalizeValue(def, val);
  }

  return { kindId, enabled, fields: base.fields };
}

function decodeHashPayload(encoded: string): WizardState | null {
  try {
    const decoded = base64UrlDecode(encoded);
    const parsed = JSON.parse(decoded) as unknown;
    return validateWizardPayload(parsed);
  } catch {
    return null;
  }
}

function stableNormalizeState(state: WizardState): string {
  return JSON.stringify({
    kindId: state.kindId,
    fields: state.fields,
    enabled: state.enabled,
  });
}

function stripNexopsSessionQuery(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('nexops_session')) return;
    url.searchParams.delete('nexops_session');
    const q = url.search;
    window.history.replaceState({}, '', `${url.pathname}${q}${url.hash}`);
  } catch {
    /* ignore */
  }
}

export const WizardPage: React.FC<WizardPageProps> = ({ onCreateProject }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const defaultKind = KINDS[0];
  const lastAppliedNormalizedRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [wizardState, setWizardState] = useState<WizardState>(() => {
    const encoded = readNxwEncodedFromHash();
    const fromHash = encoded ? decodeHashPayload(encoded) : null;
    const initial = fromHash ?? initialStateForKind(defaultKind);
    lastAppliedNormalizedRef.current = stableNormalizeState(initial);
    return initial;
  });
  const [compileOutput, setCompileOutput] = useState<string>('Compile output will appear here.');
  const [isCompiling, setIsCompiling] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [wizardDeployRecords, setWizardDeployRecords] = useState<WizardDeployRecord[]>(() => getWizardDeploys());
  const [debouncedBuild, setDebouncedBuild] = useState<BuildOptions>({
    fields: wizardState.fields,
    enabled: wizardState.enabled,
  });

  const activeKind = KINDS_BY_ID[wizardState.kindId] ?? defaultKind;

  const refreshWizardDeploys = useCallback(() => {
    setWizardDeployRecords(getWizardDeploys());
  }, []);

  const fieldDefsVisible = useMemo(
    () => collectFieldDefs(activeKind, wizardState.enabled),
    [activeKind, wizardState.enabled]
  );

  const applyHashFromLocation = useCallback(() => {
    const encoded = readNxwEncodedFromHash();
    if (!encoded) return;
    const parsed = decodeHashPayload(encoded);
    if (!parsed) return;

    const normalizedNew = stableNormalizeState(parsed);
    if (normalizedNew === lastAppliedNormalizedRef.current && isDirty) return;

    if (normalizedNew !== lastAppliedNormalizedRef.current) {
      lastAppliedNormalizedRef.current = normalizedNew;
      setIsDirty(false);
      setWizardState(parsed);
      setCompileOutput('Compile output will appear here.');
      return;
    }

    if (!isDirty) {
      setWizardState(parsed);
    }
  }, [isDirty]);

  useEffect(() => {
    stripNexopsSessionQuery();
  }, []);

  useEffect(() => {
    applyHashFromLocation();
  }, [applyHashFromLocation]);

  useEffect(() => {
    const onHashChange = () => applyHashFromLocation();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHashFromLocation]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedBuild({ fields: wizardState.fields, enabled: wizardState.enabled });
    }, 120);
    return () => window.clearTimeout(t);
  }, [wizardState.fields, wizardState.enabled]);

  const generated = useMemo(() => generate(activeKind, debouncedBuild), [activeKind, debouncedBuild]);
  const fieldErrors = useMemo(
    () => validateAllFields(activeKind, wizardState.enabled, wizardState.fields),
    [activeKind, wizardState.enabled, wizardState.fields]
  );
  const canAct = Object.keys(fieldErrors).length === 0 && generated.constraintErrors.length === 0;

  const createProjectFromCode = useCallback(
    (code: string) => {
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
    },
    [activeKind.name, onCreateProject]
  );

  const runDownloadZip = useCallback(async () => {
    const zip = new JSZip();
    zip.file('contract.cash', generated.source);
    zip.file(
      'metadata.json',
      JSON.stringify(
        {
          kindId: activeKind.id,
          fields: wizardState.fields,
          enabled: wizardState.enabled,
          hash: generated.hash,
          warnings: generated.warnings,
        },
        null,
        2
      )
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeKind.id}-wizard.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    activeKind.id,
    generated.hash,
    generated.source,
    generated.warnings,
    wizardState.enabled,
    wizardState.fields,
  ]);

  const redirectToLoginForWizardExport = useCallback(
    (pending: 'download' | 'open_workspace') => {
      persistAuthReturnIfAbsent(loginSafeReturnHref());
      resetHasHandledAuthBeforeLoginRedirect();
      setWizardPendingAction(pending);
      navigate(`/login?return=${encodeURIComponent(loginSafeReturnHref())}`);
    },
    [navigate]
  );

  const ensureLoggedInForExport = useCallback(
    (pending: 'download' | 'open_workspace'): boolean => {
      if (user) return true;
      if (isLocalhostRuntime()) return true;
      redirectToLoginForWizardExport(pending);
      return false;
    },
    [user, redirectToLoginForWizardExport]
  );

  // Resume post-login: depend only on user + canAct so composer is valid and we never re-fire on generated churn.
  useEffect(() => {
    if (!user || !canAct) return;
    const action = consumeWizardPendingAction();
    if (!action) return;
    if (action === 'download') {
      void runDownloadZip();
    } else if (action === 'open_workspace') {
      createProjectFromCode(generated.source);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot resume when user && canAct; avoid re-fire on generated/source updates
  }, [user, canAct]);

  const handleSelectKind = (kindId: string) => {
    const kind = KINDS_BY_ID[kindId];
    if (!kind) return;
    setIsDirty(true);
    const next = initialStateForKind(kind);
    lastAppliedNormalizedRef.current = stableNormalizeState(next);
    setWizardState(next);
    setCompileOutput('Compile output will appear here.');
  };

  const handleToggleFeature = (featureId: string) => {
    const feature = activeKind.features.find((f) => f.id === featureId);
    if (!feature || feature.disabled) return;
    setIsDirty(true);
    setWizardState((prev) => {
      const nextEnabled = { ...prev.enabled, [featureId]: !prev.enabled[featureId] };
      if (nextEnabled[featureId]) {
        for (const conflict of feature.conflicts ?? []) nextEnabled[conflict] = false;
      }
      return { ...prev, enabled: nextEnabled };
    });
  };

  const handleFieldChange = (field: FieldDef, value: string | number | boolean) => {
    setIsDirty(true);
    setWizardState((prev) => ({
      ...prev,
      fields: { ...prev.fields, [field.id]: value },
    }));
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(generated.source);
    toast.success('Source copied');
  };

  const onDownload = async () => {
    if (!ensureLoggedInForExport('download')) return;
    await runDownloadZip();
  };

  const onShare = async () => {
    const payload: WizardState = {
      kindId: activeKind.id,
      fields: wizardState.fields,
      enabled: wizardState.enabled,
    };
    const encoded = base64UrlEncode(JSON.stringify(payload));
    const hash = `#${HASH_FRAGMENT_PREFIX}${encoded}`;
    const link = `${window.location.origin}${window.location.pathname}${hash}`;
    await navigator.clipboard.writeText(link);
    window.history.replaceState({}, '', hash);
    toast.success('Share link copied');
  };

  const onCompile = async () => {
    setIsCompiling(true);
    try {
      const out = compileCashScript(generated.source);
      if (out.success && out.artifact) {
        setCompileOutput(
          ['Compile: PASS', `Contract: ${out.artifact.contractName}`, `Bytecode length: ${out.artifact.bytecode.length}`].join(
            '\n'
          )
        );
      } else {
        setCompileOutput(['Compile: FAIL', ...(out.errors ?? ['Unknown error'])].join('\n'));
      }
    } finally {
      setIsCompiling(false);
    }
  };

  const onOpenWorkspace = () => {
    if (!ensureLoggedInForExport('open_workspace')) return;
    createProjectFromCode(generated.source);
  };

  return (
    <div className="h-full min-h-0 w-full bg-[#050a08] overflow-hidden flex flex-col px-2 py-2 sm:px-3 sm:py-2">
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="border border-white/10 rounded-lg bg-black/20 overflow-hidden flex flex-col flex-1 min-h-0">
          <KindTabs kinds={KINDS} activeKindId={activeKind.id} onSelect={handleSelectKind} />
          <div className="flex flex-col xl:flex-row xl:items-stretch flex-1 min-h-0 xl:h-full">
            <div className="flex flex-col flex-1 min-h-[260px] w-full xl:flex-none xl:h-full xl:min-h-0 xl:w-[360px] xl:max-w-[360px] shrink-0 xl:shrink-0 border-b xl:border-b-0 xl:border-r border-white/10 overflow-hidden">
              <FeaturePanel
                kind={activeKind}
                values={wizardState.fields}
                enabled={wizardState.enabled}
                errors={fieldErrors}
                onToggle={handleToggleFeature}
                onFieldChange={handleFieldChange}
              />
            </div>
            <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
              <div className="p-3 sm:p-4 flex flex-col gap-4 flex-1 overflow-y-auto overscroll-y-contain custom-scrollbar min-h-0">
                {generated.constraintErrors.length > 0 && (
                  <div className="shrink-0 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-red-300 text-xs space-y-1">
                    {generated.constraintErrors.map((e) => (
                      <div key={e}>- {e}</div>
                    ))}
                  </div>
                )}
                <div className="shrink-0">
                  <ActionsBar
                    copyDisabled={false}
                    compileDisabled={isCompiling}
                    deployDisabled={!canAct}
                    downloadDisabled={!canAct}
                    shareDisabled={!canAct}
                    openDisabled={!canAct}
                    onCopy={onCopy}
                    onDownload={onDownload}
                    onShare={onShare}
                    onCompile={onCompile}
                    onDeploy={() => setDeployModalOpen(true)}
                    onOpenWorkspace={onOpenWorkspace}
                  />
                </div>
                <CodePreview code={generated.source} hash={generated.hash} warnings={generated.warnings} />
                <div className="shrink-0 rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black mb-2">
                    Compile Output {isCompiling ? '(running...)' : ''}
                  </div>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">{compileOutput}</pre>
                </div>
              </div>
            </div>
            <DeployHistoryPanel kindId={activeKind.id} records={wizardDeployRecords} />
          </div>
        </div>
      </div>
      <WizardDeployPanel
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        source={generated.source}
        generatedInvariants={generated.invariants ?? []}
        kindId={activeKind.id}
        kindName={activeKind.name}
        fieldDefs={fieldDefsVisible}
        wizardFields={wizardState.fields}
        wizardEnabled={wizardState.enabled}
        onRecordSaved={refreshWizardDeploys}
      />
    </div>
  );
};
