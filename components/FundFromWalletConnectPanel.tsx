import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Wallet, Loader2 } from 'lucide-react';
import { walletConnectService, ConnectionStatus } from '../services/walletConnectService';
import { fundContractFromWalletConnect } from '../services/wcFundFromWalletConnect';
import { Button } from './UI';

/** Turn back on when Chipnet WC funding path is ready for all target wallets. */
export const SHOW_FUND_FROM_WALLET_CONNECT = false;

export interface FundFromWalletConnectPanelProps {
    contractAddress: string;
    /** Disable when no deployment address etc. */
    disabled?: boolean;
    /** After wallet signs (and typically broadcasts), refresh balances / UI */
    onFunded?: () => void | Promise<void>;
}

export const FundFromWalletConnectPanel: React.FC<FundFromWalletConnectPanelProps> = (props) => {
    if (!SHOW_FUND_FROM_WALLET_CONNECT) {
        return null;
    }
    return <FundFromWalletConnectPanelInner {...props} />;
};

const FundFromWalletConnectPanelInner: React.FC<FundFromWalletConnectPanelProps> = ({
    contractAddress,
    disabled,
    onFunded,
}) => {
    const [amountSats, setAmountSats] = useState('2500');
    const [busy, setBusy] = useState(false);
    const [, setWcRev] = useState(0);

    useEffect(() => {
        const bump = () => setWcRev((n) => n + 1);
        walletConnectService.on('connection_status_changed', bump);
        walletConnectService.on('session_connected', bump);
        walletConnectService.on('session_disconnected', bump);
        return () => {
            walletConnectService.off('connection_status_changed', bump);
            walletConnectService.off('session_connected', bump);
            walletConnectService.off('session_disconnected', bump);
        };
    }, []);

    const connected =
        walletConnectService.getConnectionStatus() === ConnectionStatus.CONNECTED &&
        walletConnectService.isConnected();

    const handleFund = async () => {
        if (!contractAddress.trim()) return;
        const n = BigInt(amountSats.replace(/\s/g, '') || '0');
        if (n < 546n) {
            toast.error('Amount must be at least 546 sats (dust limit).');
            return;
        }
        const from = walletConnectService.getAddress();
        if (!from) {
            toast.error('Connect WalletConnect first.');
            return;
        }

        setBusy(true);
        const toastId = toast.loading('Opening wallet to sign funding transaction…');
        try {
            await walletConnectService.ensureInit();
            const txid = await fundContractFromWalletConnect({
                fromCashAddress: from,
                contractCashAddress: contractAddress.trim(),
                amountSats: n,
            });
            toast.success(
                `Funding broadcast · tx ${typeof txid === 'string' && txid.length > 14 ? `${txid.slice(0, 10)}…${txid.slice(-6)}` : txid}. Balance may take a few seconds.`,
                { id: toastId, duration: 6000 },
            );
            await onFunded?.();
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error(msg, { id: toastId });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border border-nexus-cyan/25 bg-nexus-cyan/5 p-4 space-y-3 text-left">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-nexus-cyan">
                <Wallet className="w-3.5 h-3.5" />
                Fund from WalletConnect
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
                Sends Chipnet BCH from your connected wallet (Paytaca, Cashonize, Zapit, …) to this contract. Ensure that
                wallet has chipnet coins first.
            </p>
            <label className="block space-y-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Amount (sats)</span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={amountSats}
                    onChange={(e) => setAmountSats(e.target.value.replace(/[^\d]/g, ''))}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-mono text-white outline-none focus:border-nexus-cyan/40"
                    disabled={busy || disabled || !connected}
                />
            </label>
            <Button
                variant="primary"
                className="w-full text-[10px] font-black uppercase tracking-tight"
                disabled={disabled || !connected || busy}
                isLoading={busy}
                icon={busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wallet className="w-3.5 h-3.5" />}
                onClick={() => void handleFund()}
            >
                Send from connected wallet
            </Button>
            {!connected && (
                <p className="text-[9px] text-amber-400/90">
                    Connect WalletConnect from the top bar or Interact step first.
                </p>
            )}
        </div>
    );
};
