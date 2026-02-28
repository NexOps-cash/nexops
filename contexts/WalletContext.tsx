import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LocalWallet } from '../types';
import LocalWalletService from '../services/localWalletService';
import { fetchUTXOs, requestFaucetFunds } from '../services/blockchainService';
import { toast } from 'react-hot-toast';

interface WalletContextType {
    wallets: LocalWallet[];
    activeWalletId: string | null;
    activeWallet: LocalWallet | null;
    addWallet: (name: string) => Promise<void>;
    removeWallet: (id: string) => void;
    setActiveWallet: (id: string) => void;
    refreshBalances: () => Promise<void>;
    fundWallet: (id: string) => Promise<void>;
    getWalletById: (id: string) => LocalWallet | undefined;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = 'neyops_wallets';
const ACTIVE_STORAGE_KEY = 'neyops_active_wallet_id';

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [wallets, setWallets] = useState<LocalWallet[]>([]);
    const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

    // 1. Initial Load
    useEffect(() => {
        const savedWallets = localStorage.getItem(STORAGE_KEY);
        const savedActiveId = localStorage.getItem(ACTIVE_STORAGE_KEY);

        if (savedWallets) {
            try {
                const parsed = JSON.parse(savedWallets);
                setWallets(parsed);
                if (savedActiveId && parsed.find((w: LocalWallet) => w.id === savedActiveId)) {
                    setActiveWalletId(savedActiveId);
                } else if (parsed.length > 0) {
                    setActiveWalletId(parsed[0].id);
                }
            } catch (e) {
                console.error("Failed to parse wallets from localStorage", e);
            }
        }
    }, []);

    // 2. Persistence
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    }, [wallets]);

    useEffect(() => {
        if (activeWalletId) {
            localStorage.setItem(ACTIVE_STORAGE_KEY, activeWalletId);
        }
    }, [activeWalletId]);

    // 3. Derived State
    const activeWallet = wallets.find(w => w.id === activeWalletId) || null;

    // 4. Actions
    const addWallet = async (name: string) => {
        if (wallets.some(w => w.name.toLowerCase() === name.toLowerCase())) {
            toast.error("A wallet with this name already exists.");
            return;
        }

        try {
            const newWallet = await LocalWalletService.createWallet(name);
            setWallets(prev => [...prev, newWallet]);
            if (!activeWalletId) setActiveWalletId(newWallet.id);
            toast.success(`Wallet "${name}" created.`);
        } catch (e) {
            console.error("Failed to create wallet", e);
            toast.error("Failed to create wallet.");
        }
    };

    const removeWallet = (id: string) => {
        setWallets(prev => prev.filter(w => w.id !== id));
        if (activeWalletId === id) {
            const remaining = wallets.filter(w => w.id !== id);
            setActiveWalletId(remaining.length > 0 ? remaining[0].id : null);
        }
        toast.success("Wallet removed.");
    };

    const setActiveWallet = (id: string) => {
        setActiveWalletId(id);
    };

    const refreshBalances = useCallback(async () => {
        if (wallets.length === 0) return;

        console.log("Refreshing all wallet balances...");
        const updatedWallets = await Promise.all(wallets.map(async (w) => {
            try {
                const utxos = await fetchUTXOs(w.address);
                const balance = utxos.reduce((sum, u) => sum + u.value, 0);
                return { ...w, balance };
            } catch (e) {
                console.error(`Failed to refresh balance for ${w.name}`, e);
                return w;
            }
        }));

        setWallets(updatedWallets);
    }, [wallets]);

    const fundWallet = async (id: string) => {
        const wallet = wallets.find(w => w.id === id);
        if (!wallet) return;

        toast.loading("Requesting faucet funds...", { id: 'faucet-loading' });
        try {
            const res = await requestFaucetFunds(wallet.address);
            if (res.success) {
                toast.success("Faucet request successful! Waiting for detection...", { id: 'faucet-loading' });
                // We don't poll here, user can refresh or we refresh once
                setTimeout(refreshBalances, 5000);
            } else {
                toast.error(`Faucet failed: ${res.error || 'Unknown error'}`, { id: 'faucet-loading' });
            }
        } catch (e) {
            toast.error("Faucet request failed.", { id: 'faucet-loading' });
        }
    };

    const getWalletById = (id: string) => wallets.find(w => w.id === id);

    return (
        <WalletContext.Provider value={{
            wallets,
            activeWalletId,
            activeWallet,
            addWallet,
            removeWallet,
            setActiveWallet,
            refreshBalances,
            fundWallet,
            getWalletById
        }}>
            {children}
        </WalletContext.Provider>
    );
};

export const useWallet = () => {
    const context = useContext(WalletContext);
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
};
