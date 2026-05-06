import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ChevronDown, User } from 'lucide-react';
import LocalWalletService from '../../services/localWalletService';
import { useWallet } from '../../contexts/WalletContext';
import { ContractKind, FeatureGroup, FieldDef, collectFieldDefs } from '../../services/wizard/schema';

interface FeaturePanelProps {
  kind: ContractKind;
  values: Record<string, string | number | boolean>;
  enabled: Record<string, boolean>;
  errors: Record<string, string>;
  onToggle: (featureId: string) => void;
  onFieldChange: (field: FieldDef, value: string | number | boolean) => void;
  /** Shared with WizardTestIdentitiesSection (left rail). */
  selectedIdentityId: string | null;
  onSelectedIdentityChange: (id: string | null) => void;
}

const GROUPS: FeatureGroup[] = ['Auth', 'Timing', 'Outputs', 'Tokens', 'Policy', 'Info'];
const SENSITIVE_FIELD_IDS = new Set(['oraclePk', 'emergencyKey', 'adminPk']);
const WALLET_COMPATIBLE_TYPES = new Set(['pubkey', 'bytes', 'bytes20', 'cashAddress']);

function renderInput(
  field: FieldDef,
  value: string | number | boolean,
  onFieldChange: (field: FieldDef, value: string | number | boolean) => void
) {
  if (field.type === 'bool') {
    return (
      <input
        type="checkbox"
        checked={value === true}
        onChange={(e) => onFieldChange(field, e.target.checked)}
        className="w-4 h-4 accent-emerald-500"
      />
    );
  }
  if (field.type === 'enum') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onFieldChange(field, e.target.value)}
        className="w-full bg-[#070b09] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200"
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }
  const type = field.type === 'int' || field.type === 'blockHeight' || field.type === 'unixTime' ? 'number' : 'text';
  return (
    <input
      type={type}
      value={String(value ?? '')}
      placeholder={field.placeholder}
      onChange={(e) => onFieldChange(field, type === 'number' ? Number(e.target.value) : e.target.value)}
      className="w-full bg-[#070b09] border border-white/10 rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600"
    />
  );
}

export const FeaturePanel: React.FC<FeaturePanelProps> = ({
  kind,
  values,
  enabled,
  errors,
  onToggle,
  onFieldChange,
  selectedIdentityId,
  onSelectedIdentityChange,
}) => {
  const { wallets } = useWallet();
  const [openWalletMenuFieldId, setOpenWalletMenuFieldId] = useState<string | null>(null);
  const derivedCacheRef = useRef<Map<string, { pubkey: string; lockingBytecode: string; pkh: string }>>(new Map());

  const visibleFields = useMemo(() => collectFieldDefs(kind, enabled), [kind, enabled]);

  const isWalletCompatible = (field: FieldDef): boolean => WALLET_COMPATIBLE_TYPES.has(field.type);
  const isFieldEmpty = (fieldId: string): boolean => String(values[fieldId] ?? '').trim().length === 0;

  const highlightedFillableFields = useMemo(() => {
    const ids = new Set<string>();
    visibleFields.forEach((field) => {
      if (!isWalletCompatible(field)) return;
      if (SENSITIVE_FIELD_IDS.has(field.id)) return;
      if (!isFieldEmpty(field.id)) return;
      ids.add(field.id);
    });
    return ids;
  }, [visibleFields, values]);

  const ensureDerivedValues = async (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet) throw new Error('Wallet not found.');
    const key = `${wallet.id}:${wallet.pubkey}`;
    const cached = derivedCacheRef.current.get(key);
    if (cached && cached.pubkey === wallet.pubkey) return cached;

    const [lockingBytecode, pkh] = await Promise.all([
      LocalWalletService.getLockingBytecodeFromPubkey(wallet.pubkey),
      LocalWalletService.getPKHFromPubkey(wallet.pubkey),
    ]);
    const next = { pubkey: wallet.pubkey, lockingBytecode, pkh };
    derivedCacheRef.current.set(key, next);
    return next;
  };

  const getWalletValueForField = async (field: FieldDef, walletId: string): Promise<string> => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet) throw new Error('Wallet not found.');
    if (field.type === 'pubkey') return wallet.pubkey;
    if (field.type === 'cashAddress') return wallet.address;
    if (field.type === 'bytes') return (await ensureDerivedValues(walletId)).lockingBytecode;
    if (field.type === 'bytes20') return (await ensureDerivedValues(walletId)).pkh;
    throw new Error(`Field ${field.id} is not wallet compatible.`);
  };

  const applyWalletToField = async (field: FieldDef, walletId: string) => {
    try {
      const nextValue = await getWalletValueForField(field, walletId);
      onFieldChange(field, nextValue);
      const wallet = wallets.find((w) => w.id === walletId);
      toast.success(`Filled ${field.label} from ${wallet?.name ?? 'identity'}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fill field from identity.');
    }
  };

  const grouped = GROUPS.map((group) => ({
    group,
    features: kind.features.filter((f) => f.group === group),
  })).filter((entry) => entry.features.length > 0);

  const enabledFeatureFieldSections = useMemo(
    () =>
      kind.features.filter((f) => enabled[f.id] && (f.fields?.length ?? 0) > 0),
    [kind.features, enabled]
  );

  const renderFieldWithWalletActions = (field: FieldDef) => {
    const highlighted = !!selectedIdentityId && highlightedFillableFields.has(field.id);
    return (
      <div key={field.id}>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">{field.label}</label>
        <div className={`mt-1 flex gap-2 ${highlighted ? 'rounded border border-emerald-400/40 p-1.5' : ''}`}>
          <div className="flex-1">{renderInput(field, values[field.id] ?? '', onFieldChange)}</div>
          {wallets.length > 0 && isWalletCompatible(field) && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() =>
                  setOpenWalletMenuFieldId((prev) => (prev === field.id ? null : field.id))
                }
                className="h-full px-2 bg-emerald-500/10 border border-emerald-500/25 rounded flex items-center gap-1 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <User size={12} />
                <ChevronDown size={10} />
              </button>
              {openWalletMenuFieldId === field.id && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[180px] rounded border border-emerald-500/30 bg-[#06110d] shadow-lg shadow-emerald-950/50 p-1">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      type="button"
                      onClick={() => {
                        setOpenWalletMenuFieldId(null);
                        onSelectedIdentityChange(wallet.id);
                        void applyWalletToField(field, wallet.id);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded text-[11px] text-emerald-100 hover:bg-emerald-500/20"
                    >
                      {wallet.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {errors[field.id] && <div className="text-[10px] text-red-400 mt-1">{errors[field.id]}</div>}
        <div className="text-[10px] text-slate-400 mt-1 leading-snug">{field.description}</div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y custom-scrollbar p-4 space-y-5 [-webkit-overflow-scrolling:touch]">
        {grouped.map(({ group, features }) => (
          <div key={group}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">{group}</div>
            <div className="mt-2 space-y-2">
              {features.map((feature) => {
                const checked = !!enabled[feature.id];
                const disabled = !!feature.disabled;
                return (
                  <div key={feature.id} className="rounded-md border border-white/10 bg-white/[0.02] p-2.5">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => !disabled && onToggle(feature.id)}
                        disabled={disabled}
                        className="w-4 h-4 mt-0.5 accent-emerald-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <div className="text-xs text-slate-200 font-semibold">
                          {feature.label}
                          {disabled && (
                            <span className="ml-2 text-[10px] text-amber-400">{feature.disabledReason || 'Coming soon'}</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{feature.description}</div>
                      </div>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-black">Base fields</div>
          <div className="mt-3 space-y-3">
            {kind.fields.map((field) => renderFieldWithWalletActions(field))}
          </div>
        </div>

        {enabledFeatureFieldSections.map((feature) => (
          <div key={`fields-${feature.id}`}>
            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/90 font-black">{feature.label}</div>
            <div className="mt-3 space-y-3">
              {feature.fields!.map((field) => renderFieldWithWalletActions(field))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
