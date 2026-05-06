import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Wallet } from 'lucide-react';
import LocalWalletService from '../../services/localWalletService';
import { useWallet } from '../../contexts/WalletContext';
import type { FieldDef } from '../../services/wizard/schema';

type FillMode = 'pubkey' | 'lockingBytecode';
interface BulkPresetStep {
  fieldId: string;
  walletIndex: number;
  mode: FillMode;
}
interface BulkPreset {
  id: string;
  label: string;
  minWallets: number;
  steps: BulkPresetStep[];
}

interface ConfirmDialogState {
  title: string;
  message: string;
  resolve: (ok: boolean) => void;
}

const SENSITIVE_FIELD_IDS = new Set(['oraclePk', 'emergencyKey', 'adminPk']);

const WIZARD_BULK_PRESETS: Record<string, BulkPreset[]> = {
  multisig: [
    {
      id: 'multisig-signers',
      label: 'Fill signers (pk1-pk3)',
      minWallets: 3,
      steps: [
        { fieldId: 'pk1', walletIndex: 0, mode: 'pubkey' },
        { fieldId: 'pk2', walletIndex: 1, mode: 'pubkey' },
        { fieldId: 'pk3', walletIndex: 2, mode: 'pubkey' },
      ],
    },
  ],
  escrow: [
    {
      id: 'escrow-parties',
      label: 'Fill party pubkeys',
      minWallets: 3,
      steps: [
        { fieldId: 'buyerPk', walletIndex: 0, mode: 'pubkey' },
        { fieldId: 'sellerPk', walletIndex: 1, mode: 'pubkey' },
        { fieldId: 'arbiterPk', walletIndex: 2, mode: 'pubkey' },
      ],
    },
    {
      id: 'escrow-bytecodes',
      label: 'Fill buyer/seller P2PKH bytecode',
      minWallets: 2,
      steps: [
        { fieldId: 'buyerLockingBytecode', walletIndex: 0, mode: 'lockingBytecode' },
        { fieldId: 'sellerLockingBytecode', walletIndex: 1, mode: 'lockingBytecode' },
      ],
    },
  ],
  htlc: [
    {
      id: 'htlc-parties',
      label: 'Fill sender/receiver',
      minWallets: 2,
      steps: [
        { fieldId: 'senderPk', walletIndex: 0, mode: 'pubkey' },
        { fieldId: 'receiverPk', walletIndex: 1, mode: 'pubkey' },
      ],
    },
  ],
  vesting: [
    {
      id: 'vesting-beneficiary',
      label: 'Fill beneficiary',
      minWallets: 1,
      steps: [{ fieldId: 'beneficiaryPk', walletIndex: 0, mode: 'pubkey' }],
    },
  ],
  covenant: [
    {
      id: 'covenant-owner',
      label: 'Fill owner',
      minWallets: 1,
      steps: [{ fieldId: 'ownerPk', walletIndex: 0, mode: 'pubkey' }],
    },
    {
      id: 'covenant-whitelist',
      label: 'Fill whitelist bytecode (2nd identity)',
      minWallets: 2,
      steps: [{ fieldId: 'recipientLockingBytecode', walletIndex: 1, mode: 'lockingBytecode' }],
    },
  ],
  cashToken: [
    {
      id: 'cashtoken-authority',
      label: 'Fill minting authority',
      minWallets: 1,
      steps: [{ fieldId: 'mintingPk', walletIndex: 0, mode: 'pubkey' }],
    },
  ],
};

export interface WizardTestIdentitiesSectionProps {
  kindId: string;
  visibleFields: FieldDef[];
  values: Record<string, string | number | boolean>;
  onFieldChange: (field: FieldDef, value: string | number | boolean) => void;
  selectedIdentityId: string | null;
  onSelectedIdentityChange: (id: string | null) => void;
}

export const WizardTestIdentitiesSection: React.FC<WizardTestIdentitiesSectionProps> = ({
  kindId,
  visibleFields,
  values,
  onFieldChange,
  selectedIdentityId,
  onSelectedIdentityChange,
}) => {
  const { wallets, addWallet } = useWallet();
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const derivedCacheRef = useRef<Map<string, { pubkey: string; lockingBytecode: string; pkh: string }>>(new Map());

  const visibleFieldsById = useMemo(() => {
    const map = new Map<string, FieldDef>();
    visibleFields.forEach((field) => map.set(field.id, field));
    return map;
  }, [visibleFields]);

  const isFieldVisible = (fieldId: string): boolean => visibleFieldsById.has(fieldId);
  const isFieldEmpty = (fieldId: string): boolean => String(values[fieldId] ?? '').trim().length === 0;

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === selectedIdentityId) ?? null,
    [wallets, selectedIdentityId]
  );

  const askForConfirmation = (title: string, message: string): Promise<boolean> =>
    new Promise((resolve) => {
      setConfirmDialog({ title, message, resolve });
    });

  const closeConfirmDialog = (ok: boolean) => {
    if (!confirmDialog) return;
    confirmDialog.resolve(ok);
    setConfirmDialog(null);
  };

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

  const applyWalletToField = async (field: FieldDef, walletId: string) => {
    try {
      const wallet = wallets.find((w) => w.id === walletId);
      if (!wallet) throw new Error('Wallet not found.');
      let nextValue: string;
      if (field.type === 'pubkey') nextValue = wallet.pubkey;
      else if (field.type === 'cashAddress') nextValue = wallet.address;
      else if (field.type === 'bytes') nextValue = (await ensureDerivedValues(walletId)).lockingBytecode;
      else if (field.type === 'bytes20') nextValue = (await ensureDerivedValues(walletId)).pkh;
      else throw new Error(`Field ${field.id} is not wallet compatible.`);
      onFieldChange(field, nextValue);
      toast.success(`Filled ${field.label} from ${wallet.name}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to fill field from identity.');
    }
  };

  const applyBulkPreset = async (preset: BulkPreset) => {
    if (wallets.length < preset.minWallets) {
      toast.error(`Need at least ${preset.minWallets} test identities for "${preset.label}".`);
      return;
    }
    const accepted = await askForConfirmation('Confirm Preset Apply', `Apply "${preset.label}" now?`);
    if (!accepted) return;

    const overwriteTargets = preset.steps.some((step) => {
      if (SENSITIVE_FIELD_IDS.has(step.fieldId)) return false;
      if (!isFieldVisible(step.fieldId)) return false;
      return !isFieldEmpty(step.fieldId);
    });
    const allowOverwrite =
      overwriteTargets &&
      (await askForConfirmation(
        'Overwrite Existing Values?',
        'Some target fields already have values. Replace existing values?'
      ));

    let applied = 0;
    for (const step of preset.steps) {
      if (SENSITIVE_FIELD_IDS.has(step.fieldId)) continue;
      const field = visibleFieldsById.get(step.fieldId);
      const wallet = wallets[step.walletIndex];
      if (!field || !wallet) continue;
      if (!isFieldEmpty(step.fieldId) && !allowOverwrite) continue;

      try {
        const nextValue =
          step.mode === 'pubkey'
            ? wallet.pubkey
            : (await ensureDerivedValues(wallet.id)).lockingBytecode;
        onFieldChange(field, nextValue);
        applied += 1;
      } catch {
        /* continue */
      }
    }
    if (applied === 0) {
      toast('No visible empty fields were updated.', { icon: 'ℹ️' });
    } else {
      toast.success(`Applied ${applied} field${applied === 1 ? '' : 's'} from "${preset.label}".`);
    }
  };

  const handleCreateTestIdentities = async (count: number) => {
    try {
      for (let i = 0; i < count; i += 1) {
        const name = `Test Identity ${wallets.length + i + 1}`;
        await addWallet(name);
      }
    } catch {
      toast.error('Failed to create test identities.');
    }
  };

  const fillNextEmptyCompatibleField = async () => {
    const WALLET_COMPATIBLE_TYPES = new Set(['pubkey', 'bytes', 'bytes20', 'cashAddress']);
    if (!selectedWallet) {
      toast.error('Select a test identity first.');
      return;
    }
    const nextField = visibleFields.find(
      (field) =>
        WALLET_COMPATIBLE_TYPES.has(field.type) &&
        !SENSITIVE_FIELD_IDS.has(field.id) &&
        isFieldEmpty(field.id)
    );
    if (!nextField) {
      toast('No visible empty compatible fields left.', { icon: 'ℹ️' });
      return;
    }
    const accepted = await askForConfirmation(
      'Confirm Fill Next',
      `Fill next field "${nextField.label}" from ${selectedWallet.name}?`
    );
    if (!accepted) return;
    await applyWalletToField(nextField, selectedWallet.id);
  };

  const walletPresets = WIZARD_BULK_PRESETS[kindId] ?? [];

  return (
    <>
      <div className="rounded-md border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-2">
        <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-black">
          Test identities (Chipnet only - not for real funds)
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCreateTestIdentities(1)}
            className="px-2.5 py-1 text-[10px] rounded border border-white/15 text-slate-200 hover:border-emerald-400/40"
          >
            Create test identity
          </button>
          <button
            type="button"
            onClick={() => void handleCreateTestIdentities(3)}
            className="px-2.5 py-1 text-[10px] rounded border border-white/15 text-slate-200 hover:border-emerald-400/40"
          >
            Create 3 test identities
          </button>
          <button
            type="button"
            onClick={() => void fillNextEmptyCompatibleField()}
            disabled={!selectedWallet}
            className="px-2.5 py-1 text-[10px] rounded border border-white/15 text-slate-200 hover:border-emerald-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Fill next empty (selected identity)
          </button>
        </div>
        {wallets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {wallets.map((wallet) => (
              <button
                key={wallet.id}
                type="button"
                onClick={() => onSelectedIdentityChange(wallet.id)}
                className={`px-2.5 py-1 rounded text-[10px] border ${
                  selectedIdentityId === wallet.id
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                    : 'border-white/15 text-slate-300'
                }`}
              >
                {wallet.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400">No test identities yet.</div>
        )}
        {walletPresets.length > 0 && (
          <div className="pt-1 border-t border-white/10">
            <div className="text-[10px] text-slate-400 mb-2 flex items-center gap-1">
              <Wallet size={12} /> Bulk presets
            </div>
            <div className="flex flex-wrap gap-2">
              {walletPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void applyBulkPreset(preset)}
                  className="px-2.5 py-1 text-[10px] rounded border border-white/15 text-slate-200 hover:border-emerald-400/40"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-emerald-500/30 bg-[#07130f] shadow-2xl shadow-emerald-950/60">
            <div className="px-4 py-3 border-b border-white/10">
              <h3 className="text-sm font-semibold text-emerald-200">{confirmDialog.title}</h3>
            </div>
            <div className="px-4 py-4 text-sm text-slate-200">{confirmDialog.message}</div>
            <div className="px-4 pb-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirmDialog(false)}
                className="px-3 py-1.5 text-xs rounded border border-white/20 text-slate-300 hover:border-white/35"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeConfirmDialog(true)}
                className="px-3 py-1.5 text-xs rounded border border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
