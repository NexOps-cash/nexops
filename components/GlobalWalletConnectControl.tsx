import React, { useEffect, useState } from 'react';
import { ChevronDown, Copy, Loader2, LogOut, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { walletConnectService, ConnectionStatus } from '../services/walletConnectService';

/**
 * Workspace header control: pair via inline WC QR (no WalletConnect modal), or show session summary + disconnect.
 * Mirrors the compact affordances used by {@link SystemHealthControl}.
 */
export const GlobalWalletConnectControl: React.FC = () => {
    const [panelOpen, setPanelOpen] = useState(false);
    const [session, setSession] = useState(() => walletConnectService.getSession());
    const [pairingUri, setPairingUri] = useState<string | null>(null);
    const [startingPairing, setStartingPairing] = useState(false);

    useEffect(() => {
        void walletConnectService.ensureInit();
    }, []);

    useEffect(() => {
        const syncSession = () => setSession(walletConnectService.getSession());
        const onProposal = (uri: string) => {
            setPairingUri(uri);
            setStartingPairing(false);
        };
        const onConnected = () => {
            setPairingUri(null);
            setStartingPairing(false);
            syncSession();
        };
        const onDisconnected = () => {
            setPairingUri(null);
            setStartingPairing(false);
            setSession(null);
        };

        walletConnectService.on('connection_status_changed', syncSession);
        walletConnectService.on('session_proposal', onProposal);
        walletConnectService.on('session_connected', onConnected);
        walletConnectService.on('session_disconnected', onDisconnected);

        return () => {
            walletConnectService.off('connection_status_changed', syncSession);
            walletConnectService.off('session_proposal', onProposal);
            walletConnectService.off('session_connected', onConnected);
            walletConnectService.off('session_disconnected', onDisconnected);
        };
    }, []);

    const connected =
        walletConnectService.getConnectionStatus() === ConnectionStatus.CONNECTED && walletConnectService.isConnected();

    /** Top-bar label: explicit states for disconnected vs connected */
    const barLabel = connected ? 'Connected' : 'Connect wallet';

    const walletLabel =
        session?.peer?.metadata?.name?.slice(0, 28) ||
        'WalletConnect';

    const address = walletConnectService.getAddress();

    const btnClass =
        'flex items-center gap-1.5 px-2 py-1 rounded-md border border-transparent hover:border-white/10 hover:bg-white/[0.06] text-slate-400 hover:text-slate-100 text-xs transition-colors h-[26px]';

    const startPairing = async () => {
        setStartingPairing(true);
        setPairingUri(null);
        try {
            await walletConnectService.ensureInit();
            const uri = await walletConnectService.connect('bch:testnet', { openWalletConnectModal: false });
            if (uri) setPairingUri(uri);
        } catch (e) {
            console.error(e);
            toast.error(e instanceof Error ? e.message : 'WalletConnect pairing failed');
            setStartingPairing(false);
        }
    };

    const disconnect = async () => {
        try {
            await walletConnectService.disconnect();
        } catch (e) {
            console.warn(e);
        }
        setPanelOpen(false);
    };

    return (
        <div className="relative flex items-center shrink-0">
            <button
                type="button"
                className={btnClass}
                aria-expanded={panelOpen}
                aria-haspopup="dialog"
                onClick={() => setPanelOpen((o) => !o)}
            >
                <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-slate-600'}`}
                />
                <Wallet size={12} className="shrink-0 opacity-80" />
                <span className="font-semibold tracking-tight max-w-[min(140px,28vw)] truncate">{barLabel}</span>
                <ChevronDown size={12} className={`shrink-0 opacity-60 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
            </button>

            {panelOpen && (
                <>
                    <div className="fixed inset-0 z-[120]" aria-hidden onClick={() => setPanelOpen(false)} />
                    <div className="absolute right-0 top-full pt-0.5 z-[130] w-[min(92vw,280px)] rounded-lg border border-white/10 bg-nexus-900 shadow-2xl p-3 space-y-3">
                        {!connected ? (
                            <>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Pair (Chipnet)
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Scan with Paytaca, Cashonize, Zapit, or another wc2-bch-bcr wallet.
                                </p>
                                {startingPairing && !pairingUri ? (
                                    <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Preparing link…
                                    </div>
                                ) : pairingUri ? (
                                    <>
                                        <div className="flex justify-center bg-white p-2 rounded-xl">
                                            <QRCodeSVG value={pairingUri} size={168} />
                                        </div>
                                        <button
                                            type="button"
                                            className="flex items-center justify-center gap-2 w-full text-[10px] py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300"
                                            onClick={() => {
                                                navigator.clipboard.writeText(pairingUri);
                                                toast.success('Pairing URI copied');
                                            }}
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy URI
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="w-full py-2.5 rounded-lg bg-nexus-cyan/90 hover:bg-nexus-cyan text-nexus-950 text-[11px] font-black uppercase tracking-wide"
                                        onClick={() => void startPairing()}
                                    >
                                        Show pairing QR
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/90">
                                    Connected
                                </div>
                                <div className="space-y-1">
                                    <div className="text-sm text-white font-medium truncate">{walletLabel}</div>
                                    {address ? (
                                        <div className="font-mono text-[10px] text-nexus-cyan/90 break-all">{address}</div>
                                    ) : null}
                                </div>
                                <button
                                    type="button"
                                    className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase"
                                    onClick={() => void disconnect()}
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    Disconnect
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
