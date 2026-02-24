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

export interface FundingStatus {
    status: 'idle' | 'monitoring' | 'confirmed' | 'timeout' | 'error';
    utxos: UTXO[];
    totalValue: number;
    txid?: string;
    error?: string;
}

const TESTNET_EXPLORER = 'https://testnet.chaingraph.cash';

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

/**
 * Singleton Connection Manager
 * Manges the single Electrum connection for the application.
 */
class ElectrumManager {
    private static instance: ElectrumClient<any> | null = null;
    private static connectionPromise: Promise<ElectrumClient<any>> | null = null;

    /**
     * Get the singleton Electrum client.
     * Connects only once on the first call.
     */
    static async getClient(): Promise<ElectrumClient<any>> {
        // 1. Return existing instance if ready
        if (this.instance) return this.instance;

        // 2. Return in-flight promise if connecting
        if (this.connectionPromise) return this.connectionPromise;

        // 3. Start new connection
        this.connectionPromise = (async () => {
            try {
                console.log('[ElectrumManager] Initializing connection to Testnet...');

                // USER REQUIREMENT: Pass hostname ONLY. No protocol, no port.
                // The library interprets this and manages the transport.
                const client = new ElectrumClient<any>('Nexops-Watcher', '1.4.1', 'testnet.imaginary.cash');

                await client.connect();
                console.log('[ElectrumManager] Connected successfully.');

                this.instance = client;

                // Cleanup on disconnect
                client.on('disconnected', () => {
                    console.warn('[ElectrumManager] Disconnected. Clearing instance.');
                    this.instance = null;
                    this.connectionPromise = null;
                });

                return client;
            } catch (error) {
                console.error('[ElectrumManager] Critical Connection Failure:', error);
                this.connectionPromise = null;
                throw error;
            }
        })();

        return this.connectionPromise;
    }
}

// --- Logic ---

/**
 * Fetch UTXOs for a specific address using the shared connection.
 */
export async function fetchUTXOs(address: string): Promise<UTXO[]> {
    try {
        const client = await ElectrumManager.getClient();
        const scriptHash = addressToScriptHash(address);

        // Use generic request, library handles ID and framing
        const listUnspent = await client.request('blockchain.scripthash.listunspent', scriptHash) as any[];

        return listUnspent.map(u => ({
            txid: u.tx_hash,
            vout: u.tx_pos,
            value: u.value,
            height: u.height,
            confirmations: u.height > 0 ? 1 : 0
        }));

    } catch (error) {
        console.error('[blockchainService] UTXO fetch error:', error);
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
                        status: confirmedValue >= this.requiredAmount ? 'confirmed' : 'monitoring',
                        utxos,
                        totalValue,
                        txid: utxos[0]?.txid
                    });

                    if (confirmedValue >= this.requiredAmount) {
                        return; // Stop polling only if fully confirmed
                    }
                    return; // Stop polling since we have enough total funds (Demo UX accepts unconfirmed)
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
 */
export async function subscribeToAddress(address: string, onUpdate: (utxos: UTXO[]) => void): Promise<() => void> {
    const client = await ElectrumManager.getClient();
    const scriptHash = addressToScriptHash(address);

    const handleUpdate = async (update: any) => {
        // Electrum library passes { scripthash, status } or similar depending on version
        // We fetch fresh UTXOs on any status change
        console.log(`[Subscription] Change detected for ${address.slice(0, 8)}...`);
        const utxos = await fetchUTXOs(address);
        onUpdate(utxos);
    };

    try {
        // 1. Initial Fetch
        const initialUtxos = await fetchUTXOs(address);
        onUpdate(initialUtxos);

        // 2. Subscribe
        await client.subscribe('blockchain.scripthash.subscribe', scriptHash);

        // 3. Listen for changes
        // The @electrum-cash/network library emits update events
        client.on('blockchain.scripthash.subscribe', handleUpdate);

        // Return unsubscribe function
        return () => {
            console.log(`[Subscription] Unsubscribing from ${address.slice(0, 8)}...`);
            client.off('blockchain.scripthash.subscribe', handleUpdate);
        };
    } catch (e) {
        console.error('[Subscription] Failure:', e);
        return () => { };
    }
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
