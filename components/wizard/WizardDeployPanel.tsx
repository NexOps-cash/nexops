import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import toast from 'react-hot-toast';
import { ChevronDown, Copy, Loader2, RefreshCw, User } from 'lucide-react';
import { Modal, Button } from '../UI';
import { ConstructorForm } from '../ConstructorForm';
import type { ContractArtifact, WizardDeployRecord, WizardDeployStep } from '../../types';
import type { FieldDef } from '../../services/wizard/schema';
import { compileCashScript, verifyDeterminism } from '../../services/compilerService';
import { deriveContractAddress, coerceConstructorArgs } from '../../services/addressService';
import { pollForFunding, checkFundingNow, getExplorerLink, type FundingStatus } from '../../services/blockchainService';
import { mapWizardFieldsToArgs } from '../../services/wizard/wizardFieldsToArgs';
import { useWallet } from '../../contexts/WalletContext';
import type { ValidationResult } from '../../services/validationService';
import { addWizardDeploy } from '../../lib/wizardDeployStore';

const INVARIANT_LABELS: Record<string, string> = {
  OUTPUT_COUNT_CLAMP: 'Max outputs capped',
  OUTPUT_COUNT_GUARD: 'Min outputs enforced',
  VALUE_PRESERVING_COVENANT: 'Value preserved',
  BOUND_RECIPIENT: 'Locked recipient',
  TOKEN_CATEGORY_CONTINUITY: 'Token category locked',
  DISTINCT_PUBKEYS: 'Distinct keys enforced',
};

function parseInvariantIdsFromSource(source: string): string[] {
  const set = new Set<string>();
  const re = /@nexops-invariants:\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((id) => set.add(id));
  }
  return [...set];
}

function resolveInvariantList(generatedInvariants: string[], source: string): string[] {
  if (generatedInvariants.length > 0) return generatedInvariants;
  return parseInvariantIdsFromSource(source);
}

function tryTokenAddress(artifact: ContractArtifact, args: string[]): string | undefined {
  try {
    const provider = new ElectrumNetworkProvider(Network.CHIPNET);
    const typedArgs = coerceConstructorArgs(artifact.constructorInputs, args);
    const c = new Contract(artifact as never, typedArgs, { provider });
    return (c as { tokenAddress?: string }).tokenAddress || undefined;
  } catch {
    return undefined;
  }
}

export interface WizardDeployPanelProps {
  isOpen: boolean;
  onClose: () => void;
  source: string;
  generatedInvariants: string[];
  kindId: string;
  kindName: string;
  fieldDefs: FieldDef[];
  wizardFields: Record<string, string | number | boolean>;
  wizardEnabled: Record<string, boolean>;
  onRecordSaved: () => void;
}

export const WizardDeployPanel: React.FC<WizardDeployPanelProps> = ({
  isOpen,
  onClose,
  source,
  generatedInvariants,
  kindId,
  kindName,
  fieldDefs,
  wizardFields,
  wizardEnabled,
  onRecordSaved,
}) => {
  const { wallets, activeWallet } = useWallet();
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [compileBusy, setCompileBusy] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [determinismOk, setDeterminismOk] = useState(false);
  const [artifact, setArtifact] = useState<ContractArtifact | null>(null);
  const [deployStep, setDeployStep] = useState<WizardDeployStep>(0);
  const [constructorArgs, setConstructorArgs] = useState<string[]>([]);
  const [constructorValidations, setConstructorValidations] = useState<Record<string, ValidationResult>>({});
  const [fundingAmount, setFundingAmount] = useState(2000);
  const [paymentUri, setPaymentUri] = useState<string | null>(null);
  const [fundingStatus, setFundingStatus] = useState<FundingStatus>({ status: 'idle', utxos: [], totalValue: 0 });
  const [txHash, setTxHash] = useState<string | null>(null);
  const [stepBanner, setStepBanner] = useState<string | null>(null);
  const [fundingCheckBusy, setFundingCheckBusy] = useState(false);
  const pollGenRef = useRef(0);

  useEffect(() => {
    if (!wallets.length) {
      setSelectedWalletId(null);
      return;
    }
    if (selectedWalletId && wallets.some((w) => w.id === selectedWalletId)) return;
    setSelectedWalletId(activeWallet?.id ?? wallets[0]?.id ?? null);
  }, [wallets, activeWallet, selectedWalletId]);

  const selectedWallet = wallets.find((w) => w.id === selectedWalletId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      setCompileError(null);
      setArtifact(null);
      setDeterminismOk(false);
      setDeployStep(0);
      setConstructorArgs([]);
      setConstructorValidations({});
      setFundingAmount(2000);
      setPaymentUri(null);
      setFundingStatus({ status: 'idle', utxos: [], totalValue: 0 });
      setTxHash(null);
      setStepBanner(null);
      setFundingCheckBusy(false);
      pollGenRef.current += 1;
      return;
    }

    let cancelled = false;
    setCompileBusy(true);
    setCompileError(null);
    setArtifact(null);
    setDeterminismOk(false);

    void (async () => {
      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;
      const result = compileCashScript(source);
      if (!result.success || !result.artifact) {
        if (!cancelled) {
          setCompileError(result.errors?.join('\n') ?? 'Compilation failed.');
          setCompileBusy(false);
        }
        return;
      }
      const ok = await verifyDeterminism(source, result.artifact.bytecode);
      if (cancelled) return;
      if (!ok) {
        setCompileError('Determinism check failed. Bytecode is not reproducible.');
        setCompileBusy(false);
        return;
      }
      const prefilled = mapWizardFieldsToArgs(fieldDefs, result.artifact.constructorInputs, wizardFields);
      setArtifact(result.artifact);
      setConstructorArgs(prefilled);
      setDeterminismOk(true);
      setDeployStep(0);
      setCompileBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, source, fieldDefs, wizardFields]);

  const invariantIds = useMemo(() => resolveInvariantList(generatedInvariants, source), [generatedInvariants, source]);

  const addressDerivation = useMemo(() => {
    if (!artifact || constructorArgs.length !== artifact.constructorInputs.length) {
      return { derivedAddress: '', derivationError: null as string | null, incomplete: true };
    }
    if (constructorArgs.some((a) => !String(a).trim())) {
      return { derivedAddress: '', derivationError: null as string | null, incomplete: true };
    }
    try {
      const addr = deriveContractAddress(artifact, constructorArgs);
      return { derivedAddress: addr, derivationError: null as string | null, incomplete: false };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { derivedAddress: '', derivationError: msg, incomplete: false };
    }
  }, [artifact, constructorArgs]);

  const commitFundingRecord = useCallback(
    (status: FundingStatus, addr: string) => {
      if (status.status !== 'confirmed' || !artifact) return;
      setTxHash(status.txid ?? null);
      setDeployStep(3);
      const tokenAddress = tryTokenAddress(artifact, constructorArgs);
      const utxo = status.utxos.find((u) => u.txid === status.txid) ?? status.utxos[0];
      const record: WizardDeployRecord = {
        id: crypto.randomUUID(),
        kindId,
        kindName,
        contractAddress: addr,
        tokenAddress,
        constructorArgs: [...constructorArgs],
        wizardFieldSnapshot: { ...wizardFields },
        wizardEnabled: { ...wizardEnabled },
        invariants: invariantIds,
        fundingTxid: status.txid ?? utxo?.txid ?? '',
        fundingAmountSats: fundingAmount,
        timestamp: Date.now(),
        network: 'chipnet',
        artifact,
      };
      addWizardDeploy(record);
      onRecordSaved();
      toast.success('Contract funded on Chipnet.');
    },
    [
      artifact,
      constructorArgs,
      fundingAmount,
      invariantIds,
      kindId,
      kindName,
      onRecordSaved,
      wizardEnabled,
      wizardFields,
    ]
  );

  const hasCriticalValidationErrors = useCallback(() => {
    return Object.values(constructorValidations).some((v) => v?.severity === 'error');
  }, [constructorValidations]);

  const canProceedStep0 = useMemo(() => {
    if (!artifact || compileBusy || !!compileError) return false;
    if (constructorArgs.length !== artifact.constructorInputs.length) return false;
    if (constructorArgs.some((v) => String(v).trim() === '')) return false;
    if (hasCriticalValidationErrors()) return false;
    if (!addressDerivation.derivedAddress || addressDerivation.incomplete || addressDerivation.derivationError)
      return false;
    return true;
  }, [
    artifact,
    compileBusy,
    compileError,
    constructorArgs,
    hasCriticalValidationErrors,
    addressDerivation,
  ]);

  const handleConfirmStep0 = () => {
    if (!canProceedStep0) {
      setStepBanner('Fill all required fields before continuing.');
      return;
    }
    setStepBanner(null);
    setDeployStep(1);
  };

  const handleStartMonitoring = async () => {
    const addr = addressDerivation.derivedAddress;
    if (!artifact || !addr) {
      toast.error('Cannot derive contract address.');
      return;
    }
    const gen = ++pollGenRef.current;
    const amountBch = fundingAmount / 100_000_000;
    const uri = `${addr}?amount=${amountBch.toFixed(8)}&label=NexOps%20WizardDeploy`;
    setPaymentUri(uri);
    setDeployStep(2);
    setFundingStatus({ status: 'monitoring', utxos: [], totalValue: 0 });

    try {
      await pollForFunding(
        addr,
        fundingAmount,
        (status) => {
          if (gen !== pollGenRef.current) return;
          setFundingStatus(status);
          if (status.status === 'confirmed') {
            commitFundingRecord(status, addr);
          }
        },
        300_000
      );
    } catch (err: unknown) {
      if (gen !== pollGenRef.current) return;
      const fs = err as FundingStatus;
      setFundingStatus(
        fs?.status
          ? fs
          : { status: 'error', utxos: [], totalValue: 0, error: err instanceof Error ? err.message : 'Monitoring failed' }
      );
      setDeployStep('error');
    }
  };

  const handleManualFundingCheck = async () => {
    const addr = addressDerivation.derivedAddress;
    if (!artifact || !addr || deployStep !== 2) return;
    setFundingCheckBusy(true);
    try {
      const status = await checkFundingNow(addr, fundingAmount);
      if (status.status === 'confirmed') {
        pollGenRef.current += 1;
      }
      setFundingStatus(status);
      if (status.status === 'confirmed') {
        commitFundingRecord(status, addr);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not reach Electrum to check funding.');
    } finally {
      setFundingCheckBusy(false);
    }
  };

  const handleRetrySameAmount = () => {
    pollGenRef.current += 1;
    void handleStartMonitoring();
  };

  const handleChangeAmountRestart = () => {
    pollGenRef.current += 1;
    setDeployStep(1);
    setFundingStatus({ status: 'idle', utxos: [], totalValue: 0 });
    setFundingCheckBusy(false);
  };

  const handleResetDeploy = () => {
    pollGenRef.current += 1;
    setDeployStep(0);
    setPaymentUri(null);
    setFundingStatus({ status: 'idle', utxos: [], totalValue: 0 });
    setTxHash(null);
    setStepBanner(null);
    setFundingCheckBusy(false);
  };

  const handleDeployAnother = () => {
    pollGenRef.current += 1;
    setDeployStep(0);
    setPaymentUri(null);
    setFundingStatus({ status: 'idle', utxos: [], totalValue: 0 });
    setTxHash(null);
    setStepBanner(null);
    setFundingCheckBusy(false);
  };

  const stepTitle = useMemo(() => {
    switch (deployStep) {
      case 0:
        return { n: 1, label: 'Review constructor args' };
      case 1:
        return { n: 2, label: 'Set funding amount' };
      case 2:
        return { n: 3, label: 'Send payment' };
      case 3:
        return { n: 4, label: 'Confirmed' };
      case 'error':
        return { n: 3, label: 'Funding interrupted' };
      default:
        return { n: 1, label: '' };
    }
  }, [deployStep]);

  const pubkeyHighlightSet = useMemo(() => {
    const pk = selectedWallet?.pubkey?.trim().toLowerCase();
    if (!pk || !artifact) return new Set<number>();
    const set = new Set<number>();
    artifact.constructorInputs.forEach((inp, i) => {
      if (inp.type === 'pubkey' && String(constructorArgs[i] ?? '').trim().toLowerCase() === pk) {
        set.add(i);
      }
    });
    return set;
  }, [artifact, constructorArgs, selectedWallet]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl max-h-[90vh] overflow-y-auto" title={`Deploy — ${kindName}`}>
      <div className="space-y-4 text-slate-200">
        {compileBusy && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Compiling & verifying determinism…
          </div>
        )}
        {compileError && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300 whitespace-pre-wrap">
            {compileError}
          </div>
        )}
        {determinismOk && artifact && (
          <>
            <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">
              Step {stepTitle.n} of 4 — {stepTitle.label}
            </div>

            {(deployStep === 0 || deployStep === 1 || deployStep === 2 || deployStep === 'error') && (
              <>
                {invariantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded border border-white/10 bg-black/30 p-2">
                    <span className="text-[9px] text-slate-500 uppercase font-black w-full mb-1">Contract guards</span>
                    {invariantIds.map((id) => (
                      <span
                        key={id}
                        className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/25 text-emerald-200"
                      >
                        {INVARIANT_LABELS[id] ?? id}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rounded border border-white/10 bg-black/25 p-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Deploy identity context</div>
                  {!wallets.length ? (
                    <p className="text-xs text-amber-300">
                      No test identity selected — create identities in the wizard fields panel to speed up pubkey fills.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-300">
                        Deploying with identity:{' '}
                        <span className="font-mono text-emerald-300">{selectedWallet?.name ?? '—'}</span>
                      </span>
                      <div className="relative inline-flex">
                        <select
                          className="appearance-none bg-emerald-500/10 border border-emerald-500/25 rounded px-2 py-1 text-[10px] text-emerald-200 pr-6 cursor-pointer"
                          value={selectedWalletId ?? ''}
                          onChange={(e) => setSelectedWalletId(e.target.value || null)}
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-400" />
                      </div>
                      {selectedWallet && (
                        <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]" title={selectedWallet.pubkey}>
                          pk {selectedWallet.pubkey.slice(0, 10)}…
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {deployStep === 0 ? (
              <>
                {stepBanner && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {stepBanner}
                  </div>
                )}
                <ConstructorForm
                  inputs={artifact.constructorInputs}
                  values={constructorArgs}
                  onChange={(args, vals) => {
                    setConstructorArgs(args);
                    setConstructorValidations(vals);
                  }}
                />
                <div className="rounded border border-white/10 bg-black/30 p-3 space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Derived contract address</div>
                  <p className="text-[10px] text-slate-500 mb-1">
                    Token-aware CashAddr (matches Paytaca send screen). Some wallets label it{' '}
                    <span className="font-mono text-slate-400">bitcoincash:</span> but it is the same contract on Chipnet.
                  </p>
                  {addressDerivation.incomplete ? (
                    <p className="text-xs text-slate-500">Address: — (fill all fields)</p>
                  ) : addressDerivation.derivationError ? (
                    <p className="text-xs text-red-400">{addressDerivation.derivationError}</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-emerald-300 break-all">{addressDerivation.derivedAddress}</span>
                        <Button
                          variant="glass"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => {
                            void navigator.clipboard.writeText(addressDerivation.derivedAddress);
                            toast.success('Address copied');
                          }}
                          icon={<Copy size={12} />}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-[10px] text-slate-500">Address updates as you edit inputs.</p>
                    </>
                  )}
                </div>
                {artifact.constructorInputs.map((inp, i) =>
                  pubkeyHighlightSet.has(i) ? (
                    <div key={inp.name} className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <User size={12} /> Matches selected identity: <span className="font-mono">{inp.name}</span>
                    </div>
                  ) : null
                )}
                <div className="flex justify-end pt-2">
                  <Button variant="primary" disabled={!canProceedStep0} onClick={handleConfirmStep0}>
                    Confirm &amp; continue
                  </Button>
                </div>
              </>
            ) : null}

            {deployStep === 'error' && (
              <div className="rounded border border-red-500/40 bg-red-500/10 p-4 space-y-3">
                <p className="text-sm text-red-200 font-semibold">Funding did not complete</p>
                {addressDerivation.derivedAddress && (
                  <p className="text-[10px] font-mono text-slate-400 break-all">
                    Contract address: {addressDerivation.derivedAddress}
                  </p>
                )}
                <p className="text-xs text-red-300/90">
                  {fundingStatus.status === 'timeout'
                    ? 'No payment detected within 5 minutes.'
                    : fundingStatus.error ?? 'An error occurred while monitoring.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={handleRetrySameAmount}>
                    Retry with same amount
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleChangeAmountRestart}>
                    Change amount → restart
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleResetDeploy}>
                    Reset deploy (back to args)
                  </Button>
                </div>
              </div>
            )}

            {deployStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Choose how much you will send to fund this contract (minimum monitoring threshold).
                </p>
                <div>
                  <label className="text-[10px] uppercase font-black text-slate-500 block mb-2">
                    Funding amount: {fundingAmount.toLocaleString()} sats
                  </label>
                  <input
                    type="range"
                    min={1000}
                    max={100000}
                    step={500}
                    value={fundingAmount}
                    onChange={(e) => setFundingAmount(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setDeployStep(0)}>
                    Back
                  </Button>
                  <Button variant="primary" onClick={() => void handleStartMonitoring()}>
                    Start monitoring &amp; show QR
                  </Button>
                </div>
              </div>
            )}

            {deployStep === 2 && paymentUri && addressDerivation.derivedAddress && (
              <div className="space-y-4">
                <div className="rounded border border-emerald-500/25 bg-emerald-950/30 p-4 space-y-2">
                  <p className="text-sm font-semibold text-white">
                    Send exactly{' '}
                    <span className="text-emerald-400">{fundingAmount.toLocaleString()} sats</span> to activate this contract on{' '}
                    Chipnet.
                  </p>
                  <p className="text-xs text-slate-400">
                    Scan the QR or copy the address / BIP-21 URI. We poll Chipnet every few seconds for up to 5 minutes; tap{' '}
                    <strong className="text-slate-300">Check payment now</strong> if your wallet already sent.
                  </p>
                  <div className="flex flex-wrap gap-4 items-start justify-center sm:justify-start">
                    <div className="bg-white p-2 rounded-md">
                      <QRCodeSVG value={paymentUri} size={160} />
                    </div>
                    <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(addressDerivation.derivedAddress);
                          toast.success('Address copied');
                        }}
                      >
                        Copy contract address
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(paymentUri);
                          toast.success('Payment URI copied');
                        }}
                      >
                        Copy BIP-21 URI
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>
                      Waiting for payment… total seen {(fundingStatus.totalValue ?? 0).toLocaleString()} /{' '}
                      {fundingAmount.toLocaleString()} sats
                    </span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={fundingCheckBusy}
                    onClick={() => void handleManualFundingCheck()}
                    icon={
                      fundingCheckBusy ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )
                    }
                  >
                    Check payment now
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    pollGenRef.current += 1;
                    setDeployStep(1);
                  }}
                >
                  Change amount
                </Button>
              </div>
            )}

            {deployStep === 3 && addressDerivation.derivedAddress && (
              <div className="rounded border border-green-500/40 bg-green-500/10 p-4 space-y-3">
                <p className="text-sm text-green-300 font-black uppercase tracking-widest">Contract funded</p>
                <p className="text-xs font-mono text-emerald-200 break-all">{addressDerivation.derivedAddress}</p>
                <div className="flex flex-wrap gap-2">
                  {txHash ? (
                    <Button variant="glass" size="sm" onClick={() => window.open(getExplorerLink(txHash), '_blank')}>
                      View funding tx
                    </Button>
                  ) : null}
                  <Button
                    variant="glass"
                    size="sm"
                    onClick={() => window.open(getExplorerLink(addressDerivation.derivedAddress), '_blank')}
                  >
                    View address on explorer
                  </Button>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Opens Chipnet on <span className="text-slate-400">chipnet.bchexplorer.info</span> — same tx id string Paytaca shows.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button variant="primary" size="sm" onClick={handleDeployAnother}>
                    Deploy another
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
