/**
 * Blockchain Service - UTXO Monitoring for BCH Testnet
 * Uses Electrum Cash Network (Reliable UTXO detection)
 */
import { ElectrumClient } from '@electrum-cash/network';
import { cashAddressToLockingBytecode, sha256, binToHex } from '@bitauth/libauth';

export interface UTXO {
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
    txid?: string;
    error?: string;
}

const TESTNET_EXPLORER = 'https://chipnet.chaingraph.cash';

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

/**
 * Singleton Connection Manager
 * Manges the single Electrum connection for the application with fallback support.
 */
class ElectrumManager {
    private static instance: ElectrumClient<any> | null = null;
    private static connectionPromise: Promise<ElectrumClient<any>> | null = null;
    private static currentServerIndex = 0;

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
                    console.log(`[ElectrumManager] Initializing connection to Chipnet via ${server}...`);

                    const client = new ElectrumClient<any>('Nexops-Watcher', '1.4.1', server);

                    await client.connect();
                    console.log(`[ElectrumManager] Connected successfully to ${server}.`);

                    this.instance = client;

                    // Cleanup on disconnect
                    client.on('disconnected', () => {
                        console.warn(`[ElectrumManager] Disconnected from ${server}. Clearing instance.`);
                        this.instance = null;
                        this.connectionPromise = null;
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

/**
 * Fetch UTXOs for a specific address using the shared connection.
 */
export async function fetchUTXOs(address: string): Promise<UTXO[]> {
    try {
        const scriptHash = addressToScriptHash(address);

        // Use resilient request wrapper
        const listUnspent = await ElectrumManager.request('blockchain.scripthash.listunspent', scriptHash) as any[];

        return listUnspent.map(u => ({
            txid: u.tx_hash,
            vout: u.tx_pos,
            value: u.value || 0,
            height: u.height,
            confirmations: u.height > 0 ? 1 : 0
        }));

    } catch (error: any) {
        console.error('[blockchainService] UTXO fetch error:', error);
        // If it's a connection error, it might be worth throwing or returning a specific flag
        // but for now we return empty to avoid crashing UI
        return [];
    }
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

                const confirmedUtxos = utxos.filter(u => u.height > 0);
                const unconfirmedUtxos = utxos.filter(u => u.height === 0);

                const confirmedValue = confirmedUtxos.reduce((sum, u) => sum + u.value, 0);
                const unconfirmedValue = unconfirmedUtxos.reduce((sum, u) => sum + u.value, 0);
                const totalValue = confirmedValue + unconfirmedValue;

                console.log(`[Watcher] ${this.address.slice(0, 8)}... | ${utxos.length} UTXOs | ${totalValue}/${this.requiredAmount} (C:${confirmedValue} U:${unconfirmedValue})`);

                // Check status
                if (totalValue >= this.requiredAmount) {
                    console.log('[Watcher] Funding Detected! UTXOs found:', utxos);
                    this.emit({
                        status: 'confirmed', // Accept 0-conf for demo UX
                        utxos,
                        totalValue,
                        txid: utxos[0]?.txid
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
        return `${TESTNET_EXPLORER}/address/${value}`;
    }
    return `${TESTNET_EXPLORER}/tx/${value}`;
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
