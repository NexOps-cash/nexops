/**
 * Blockchain Service - UTXO Monitoring for BCH Testnet
 * Uses Electrum Cash Network (Reliable UTXO detection)
 */
import { ElectrumClient } from '@electrum-cash/network';
import { cashAddressToLockingBytecode, sha256, binToHex } from '@bitauth/libauth';

export interface UTXO {
    /** `tx_hash` from Electrum `listunspent` — same hex Paytaca shows and explorers index (also used for CashScript inputs). */
    txid: string;
    vout: number;
    value: number; // in satoshis
    height: number;
    confirmations: number;
}

export interface FaucetResponse {
    success: boolean;
    txid?: string;
    error?: string;
}

export interface FundingStatus {
    status: 'idle' | 'monitoring' | 'confirmed' | 'timeout' | 'error';
    utxos: UTXO[];
    totalValue: number;
    /** Matches wallet tx id when funding is detected */
    txid?: string;
    error?: string;
}

/**
 * Chipnet block explorer base URL — BCHExplorer (Bitcoin Cash Node + Fulcrum): https://chipnet.bchexplorer.info
 */
export const CHIPNET_EXPLORER_BASE = 'https://chipnet.bchexplorer.info';

// --- Pure Utilities ---

/**
 * Convert CashAddress to Electrum ScriptHash (SHA256 of locking bytecode, reversed)
 */
function addressToScriptHash(address: string): string {
    const lockResult = cashAddressToLockingBytecode(address);
    if (typeof lockResult === 'string') throw new Error(lockResult);

    // Electrum uses the SHA256 hash of the locking bytecode, interpreted as little-endian
    const bytecode = lockResult.bytecode;
    const hash = sha256.hash(bytecode);

    // Reverse the hash to match Electrum's expected little-endian format
    const reversedHash = hash.reverse();
    return binToHex(reversedHash);
}

// --- Singleton Manager ---

const FALLBACK_SERVERS = [
    'chipnet.imaginary.cash',
    'chipnet.chaingraph.cash',
    'electrum.imaginary.cash' // Some standard servers have testnet ports but we prefer explicit ones
];

/** Public list for UI transparency (same order as fallback attempts). */
export const ELECTRUM_FALLBACK_SERVERS: readonly string[] = FALLBACK_SERVERS;

export type ElectrumConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Singleton Connection Manager
 * Manges the single Electrum connection for the application with fallback support.
 */
class ElectrumManager {
    private static instance: ElectrumClient<any> | null = null;
    private static connectionPromise: Promise<ElectrumClient<any>> | null = null;
    private static currentServerIndex = 0;
    private static activeHost: string | null = null;
    private static connectionStatus: ElectrumConnectionStatus = 'idle';
    private static statusListeners = new Set<() => void>();

    private static emitStatus() {
        this.statusListeners.forEach((fn) => {
            try {
                fn();
            } catch {
                /* ignore */
            }
        });
    }

    /** Subscribe to host / status changes (connect, disconnect, rotation). */
    static subscribeStatus(listener: () => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    static getStatusSnapshot(): { host: string | null; status: ElectrumConnectionStatus } {
        return { host: this.activeHost, status: this.connectionStatus };
    }

    /**
     * Get the singleton Electrum client.
     * Connects only once on the first call, retries next server if disconnected.
     */
    static async getClient(): Promise<ElectrumClient<any>> {
        // 1. Return existing instance if ready
        if (this.instance) return this.instance;

        // 2. Return in-flight promise if connecting
        if (this.connectionPromise) return this.connectionPromise;

        // 3. Start new connection
        this.connectionPromise = (async () => {
            let attempts = 0;
            const maxAttempts = FALLBACK_SERVERS.length;

            while (attempts < maxAttempts) {
                const server = FALLBACK_SERVERS[this.currentServerIndex];
                try {
                    this.connectionStatus = 'connecting';
                    this.activeHost = null;
                    this.emitStatus();
                    console.log(`[ElectrumManager] Initializing connection to Chipnet via ${server}...`);

                    const client = new ElectrumClient<any>('Nexops-Watcher', '1.4.1', server);

                    await client.connect();
                    console.log(`[ElectrumManager] Connected successfully to ${server}.`);

                    this.instance = client;
                    this.activeHost = server;
                    this.connectionStatus = 'connected';
                    this.emitStatus();

                    // Cleanup on disconnect
                    client.on('disconnected', () => {
                        console.warn(`[ElectrumManager] Disconnected from ${server}. Clearing instance.`);
                        this.instance = null;
                        this.connectionPromise = null;
                        this.activeHost = null;
                        this.connectionStatus = 'idle';
                        this.emitStatus();
                        // Rotate server on disconnect
                        this.currentServerIndex = (this.currentServerIndex + 1) % FALLBACK_SERVERS.length;
                    });

                    return client;
                } catch (error) {
                    console.error(`[ElectrumManager] Connection Failure on ${server}:`, error);
                    this.currentServerIndex = (this.currentServerIndex + 1) % FALLBACK_SERVERS.length;
                    attempts++;
                }
            }

            this.connectionPromise = null;
            this.activeHost = null;
            this.connectionStatus = 'error';
            this.emitStatus();
            throw new Error("[ElectrumManager] Critical Failure. All fallback servers exhausted.");
        })();

        return this.connectionPromise;
    }

    /**
     * Resilient Request Sender
     * Wraps a request in a retry loop. Reconnects on failure.
     */
    static async request(method: string, ...params: any[]): Promise<any> {
        let retries = 3;
        while (retries > 0) {
            try {
                const client = await this.getClient();
                return await client.request(method, ...params);
            } catch (error: any) {
                console.warn(`[ElectrumManager] Request failed: ${method}. Retries left: ${retries - 1}`, error);

                // If it's a disconnect error, clear the instance so getClient forces a reconnect and rotates
                if (error.message && error.message.includes('disconnected server')) {
                    this.instance = null;
                    this.connectionPromise = null;
                    this.currentServerIndex = (this.currentServerIndex + 1) % FALLBACK_SERVERS.length;
                }

                retries--;
                if (retries === 0) throw error;
                // Wait briefly before retry
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }
}

/** UI / health: current Electrum host and connection state. */
export function getElectrumConnectionSnapshot(): {
    host: string | null;
    status: ElectrumConnectionStatus;
} {
    return ElectrumManager.getStatusSnapshot();
}

export function subscribeElectrumConnection(listener: () => void): () => void {
    return ElectrumManager.subscribeStatus(listener);
}

/**
 * Warm Electrum connection and verify RPC (for health probes).
 */
export async function probeElectrumConnection(): Promise<boolean> {
    try {
        await ElectrumManager.request('blockchain.headers.subscribe');
        return true;
    } catch {
        return false;
    }
}

// --- Logic ---

/**
 * Fetch the current block height of the network.
 */
export async function getBlockHeight(): Promise<number> {
    try {
        // Electrum headers.subscribe returns the current height on first call
        const header = await ElectrumManager.request('blockchain.headers.subscribe') as any;
        return header.height;
    } catch (error) {
        console.error('[blockchainService] Height fetch error:', error);
        return 0;
    }
}

/** Electrum uses 0 or -1 (and sometimes null) for unconfirmed; only positive heights are mined. */
function normalizeElectrumBlockHeight(height: unknown): number {
    if (height === null || height === undefined) return 0;
    const n = Number(height);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
}

function totalUtxoValueSats(utxos: UTXO[]): number {
    return utxos.reduce((sum, u) => sum + (u.value || 0), 0);
}

function pickLikelyFundingTxid(utxos: UTXO[]): string | undefined {
    if (!utxos.length) return undefined;
    const sorted = [...utxos].sort((a, b) => b.value - a.value);
    return sorted[0]?.txid;
}

/**
 * Fetch UTXOs for a specific address using the shared connection.
 */
export async function fetchUTXOs(address: string): Promise<UTXO[]> {
    try {
        const scriptHash = addressToScriptHash(address);

        // Use resilient request wrapper
        const listUnspent = await ElectrumManager.request('blockchain.scripthash.listunspent', scriptHash) as any[];

        return listUnspent.map((u) => ({
            txid: String(u.tx_hash ?? '').trim(),
            vout: u.tx_pos,
            value: u.value || 0,
            height: normalizeElectrumBlockHeight(u.height),
            confirmations: normalizeElectrumBlockHeight(u.height) > 0 ? 1 : 0,
        }));

    } catch (error: any) {
        console.error('[blockchainService] UTXO fetch error:', error);
        // If it's a connection error, it might be worth throwing or returning a specific flag
        // but for now we return empty to avoid crashing UI
        return [];
    }
}

/**
 * One-shot funding check (same rules as the poller). Use for manual refresh.
 */
export async function checkFundingNow(address: string, minimumRequiredSats: number): Promise<FundingStatus> {
    const utxos = await fetchUTXOs(address);
    const totalValue = totalUtxoValueSats(utxos);
    if (totalValue >= minimumRequiredSats) {
        return {
            status: 'confirmed',
            utxos,
            totalValue,
            txid: pickLikelyFundingTxid(utxos),
        };
    }
    return { status: 'monitoring', utxos, totalValue };
}

/**
 * Funding Watcher
 * Polls for UTXOs without managing connection state.
 */
class FundingWatcher {
    private active = true;

    constructor(
        private address: string,
        private requiredAmount: number,
        private onUpdate: (status: FundingStatus) => void,
        private timeoutMs: number
    ) { }

    async start() {
        const startTime = Date.now();
        const pollInterval = 1500;

        const poll = async () => {
            if (!this.active) return;

            // Check timeout
            if (Date.now() - startTime > this.timeoutMs) {
                this.emit({
                    status: 'timeout',
                    utxos: [],
                    totalValue: 0,
                    error: 'Funding timeout',
                });
                return;
            }

            try {
                // Fetch using singleton
                const utxos = await fetchUTXOs(this.address);

                // Sum every UTXO — Electrum marks mempool outputs as height -1, which previously dropped them from totals.
                const totalValue = totalUtxoValueSats(utxos);
                const confirmedValue = utxos.filter((u) => u.height > 0).reduce((sum, u) => sum + u.value, 0);

                console.log(`[Watcher] ${this.address.slice(0, 8)}... | ${utxos.length} UTXOs | ${totalValue}/${this.requiredAmount} (confirmed ${confirmedValue} sats)`);

                // Check status
                if (totalValue >= this.requiredAmount) {
                    console.log('[Watcher] Funding Detected! UTXOs found:', utxos);
                    this.emit({
                        status: 'confirmed', // Accept 0-conf for demo UX
                        utxos,
                        totalValue,
                        txid: pickLikelyFundingTxid(utxos),
                    });

                    return; // Stop polling since we have enough total funds
                } else {
                    this.emit({
                        status: 'monitoring',
                        utxos,
                        totalValue
                    });

                    // Continue
                    setTimeout(poll, pollInterval);
                }

            } catch (error) {
                // Transient error, just log and retry
                console.warn('[Watcher] Transient polling error:', error);
                setTimeout(poll, pollInterval); // Retry
            }
        };

        poll();
    }

    stop() {
        this.active = false;
    }

    private emit(status: FundingStatus) {
        if (this.active) this.onUpdate(status);
        if (status.status === 'confirmed' || status.status === 'timeout' || status.status === 'error') {
            this.active = false;
        }
    }
}

// --- Public Facade ---

/**
 * Poll for funding at an address
 * Thin facade for the FundingWatcher
 */
export async function pollForFunding(
    address: string,
    minimumRequired: number,
    onUpdate: (status: FundingStatus) => void,
    timeoutMs: number = 300000
): Promise<FundingStatus> {

    // Initial status
    onUpdate({ status: 'monitoring', utxos: [], totalValue: 0 });

    return new Promise((resolve, reject) => {

        // Wrap the user's callback to handle promise resolution
        const wrappedCallback = (status: FundingStatus) => {
            onUpdate(status);

            if (status.status === 'confirmed') resolve(status);
            if (status.status === 'timeout') reject(status);
            if (status.status === 'error') reject(status);
        };

        const watcher = new FundingWatcher(address, minimumRequired, wrappedCallback, timeoutMs);
        watcher.start();
    });
}

/**
 * Subscribe to address changes using Electrum scripthash.subscribe.
 * Calls the callback whenever there is a change.
 * Includes auto-recovery on disconnects.
 */
export async function subscribeToAddress(address: string, onUpdate: (utxos: UTXO[]) => void): Promise<() => void> {
    const scriptHash = addressToScriptHash(address);
    let isSubscribed = true;
    let currentClient: ElectrumClient<any> | null = null;
    let handleUpdate: any = null;

    const setupSubscription = async () => {
        if (!isSubscribed) return;

        try {
            currentClient = await ElectrumManager.getClient();

            // 1. Initial Fetch (or Re-Sync after reconnect)
            const utxos = await fetchUTXOs(address);
            onUpdate(utxos);

            // 2. Subscribe
            await ElectrumManager.request('blockchain.scripthash.subscribe', scriptHash);

            handleUpdate = async (update: any) => {
                console.log(`[Subscription] Change detected for ${address.slice(0, 8)}...`);
                const freshUtxos = await fetchUTXOs(address);
                if (isSubscribed) onUpdate(freshUtxos);
            };

            // 3. Listen for changes
            currentClient.on('blockchain.scripthash.subscribe', handleUpdate);

            // 4. Auto-Recover
            currentClient.once('disconnected', () => {
                if (!isSubscribed) return;
                console.warn(`[Subscription] Disconnected on ${address.slice(0, 8)}... Attempting recovery.`);
                // Clean up old listener
                if (handleUpdate) currentClient?.off('blockchain.scripthash.subscribe', handleUpdate);
                // The manager will rotate the server automatically on next getClient call.
                // We wait briefly and then try to set up the subscription again.
                setTimeout(setupSubscription, 2000);
            });

        } catch (e) {
            console.error('[Subscription] Failure/Recovery Error:', e);
            if (isSubscribed) setTimeout(setupSubscription, 5000); // Try again later
        }
    };

    // Kick off the initial subscription
    setupSubscription();

    // Return true unsubscribe function
    return () => {
        console.log(`[Subscription] Unsubscribing from ${address.slice(0, 8)}...`);
        isSubscribed = false;
        if (currentClient && handleUpdate) {
            currentClient.off('blockchain.scripthash.subscribe', handleUpdate);
        }
    };
}

/**
 * Wrapper for the Explorer Link
 * Handles both Transactions and Addresses based on prefix.
 */
export function getExplorerLink(value: string): string {
    if (value.startsWith('bchtest:') || value.startsWith('bitcoincash:')) {
        return `${CHIPNET_EXPLORER_BASE}/address/${encodeURIComponent(value)}`;
    }
    return `${CHIPNET_EXPLORER_BASE}/tx/${encodeURIComponent(value.trim())}`;
}

/**
 * Consolidated Faucet Request
 * Uses rest-unstable.mainnet.cash for reliability
 */
export async function requestFaucetFunds(address: string): Promise<FaucetResponse> {
    try {
        // Ensure prefix
        const formattedAddress = address.includes(':') ? address : `bchtest:${address}`;

        console.log(`[Faucet] Requesting funds for: ${formattedAddress}`);

        const response = await fetch('https://rest-unstable.mainnet.cash/faucet/get_testnet_bch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cashaddr: formattedAddress }),
        });

        if (response.status === 405) {
            return {
                success: false,
                error: 'Faucet rejected request (405). Possible reasons: Address already has funds, rate limit hit (1 per 15m), or invalid address format.'
            };
        }

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `Faucet error (${response.status}): ${errorText || 'Unknown error'}` };
        }

        const data = await response.json();

        if (data.txid || data.txId) {
            return { success: true, txid: data.txid || data.txId };
        } else if (data.error) {
            return { success: false, error: data.error };
        }

        return { success: true };
    } catch (error: any) {
        console.error("Faucet error:", error);
        return { success: false, error: 'Funding API unreachable. Check network connection.' };
    }
}
