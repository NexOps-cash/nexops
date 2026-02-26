
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { WalletConnectModal } from '@walletconnect/modal';
import { EventEmitter } from 'events';
import { Buffer } from 'buffer';

// Polyfill Buffer for the browser environment if needed (Vite often needs this)
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------

// Load Project ID from environment variables
const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

const CHAIN_NAMESPACES = {
    bch: {
        methods: ['bch_signTransaction', 'bch_signMessage', 'bch_getAddresses'],
        events: ['addressesChanged', 'chainChanged', 'accountsChanged']
    }
};

const CAIP2_BY_NETWORK: Record<string, string> = {
    mainnet: 'bch:bitcoincash',
    chipnet: 'bch:bchtest',
};

export type ChainId = string;

// Connection Status Enum
export enum ConnectionStatus {
    DISCONNECTED = 'disconnected',  // Never connected or user disconnected
    CONNECTED = 'connected',        // Active session, peer reachable
    EXPIRED = 'expired'             // Session exists but peer unreachable/rejected OR session_delete emitted
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface WalletConnectEvents {
    'session_proposal': (uri: string) => void;
    'session_connected': (session: SessionTypes.Struct) => void;
    'session_disconnected': () => void;
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

class WalletConnectService extends EventEmitter {
    private client: SignClient | null = null;
    private modal: WalletConnectModal | null = null;
    private session: SessionTypes.Struct | null = null;
    private currentStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
    private static instance: WalletConnectService;

    private constructor() {
        super();
    }

    public static getInstance(): WalletConnectService {
        if (!WalletConnectService.instance) {
            WalletConnectService.instance = new WalletConnectService();
        }
        return WalletConnectService.instance;
    }

    /**
     * Check if wallet is connected.
     * Single source of truth - delegates to getConnectionStatus().
     */
    public isConnected(): boolean {
        return this.getConnectionStatus() === ConnectionStatus.CONNECTED;
    }

    /**
     * Get current connection status.
     * Returns DISCONNECTED, CONNECTED, or EXPIRED.
     */
    public getConnectionStatus(): ConnectionStatus {
        return this.currentStatus;
    }

    /**
     * Update connection status and emit event.
     * All state changes funnel through this method.
     */
    private updateConnectionStatus(status: ConnectionStatus) {
        if (this.currentStatus !== status) {
            this.currentStatus = status;
            this.emit('connection_status_changed', status);
            console.log(`WalletConnect status changed: ${status}`);
        }
    }

    /**
     * Initialize the WalletConnect SignClient.
     * Should be called on app mount.
     */
    public async init() {
        if (this.client) return;

        try {
            this.client = await SignClient.init({
                projectId: PROJECT_ID,
                metadata: {
                    name: 'NexOps Protocol',
                    description: 'Audit-Gated Smart Contract Deployment',
                    url: typeof window !== 'undefined' ? window.location.origin : 'https://nexops.dev',
                    icons: ['https://avatars.githubusercontent.com/u/37784886']
                }
            });

            this.modal = new WalletConnectModal({
                projectId: PROJECT_ID,
                chains: ['bch:bitcoincash', 'bch:bchtest']
            });

            this.setupEventListeners();

            // Check for restored session and validate it
            if (this.client.session.length) {
                const lastSession = this.client.session.get(this.client.session.keys[this.client.session.keys.length - 1]);
                this.session = lastSession;

                // Validate session is still active
                try {
                    // Ping to check if peer is reachable - wrap in a timeout to avoid long waits
                    const pingPromise = this.client.ping({ topic: lastSession.topic });

                    // Create a timeout promise
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Ping timeout')), 5000)
                    );

                    await Promise.race([pingPromise, timeoutPromise]);

                    this.updateConnectionStatus(ConnectionStatus.CONNECTED);
                    console.log('Session rehydrated and validated:', lastSession.topic);
                } catch (e) {
                    console.warn('[WalletConnect] Restored session is unreachable or stale:', e);
                    // If ping fails, we mark as expired. The user will need to reconnect.
                    this.updateConnectionStatus(ConnectionStatus.EXPIRED);
                }
            } else {
                this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
            }

        } catch (e) {
            console.error('WalletConnect init failed', e);
            this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
        }
    }

    /**
     * Starts the connection flow. Returns the URI for the QR code.
     */
    public async connect(validChainId: ChainId): Promise<string | undefined> {
        if (!this.client) await this.init();
        if (!this.client) throw new Error('WalletConnect Client not initialized');

        // Map internal network name to CAIP-2
        // We handle variants of 'chipnet', 'testnet' etc.
        const currentNetwork = (validChainId.includes('test') || validChainId.includes('chip')) ? 'chipnet' : 'mainnet';
        const caipChainId = CAIP2_BY_NETWORK[currentNetwork];

        const requiredNamespaces = {
            bch: {
                methods: CHAIN_NAMESPACES.bch.methods,
                events: CHAIN_NAMESPACES.bch.events,
                chains: [caipChainId]
            }
        };

        try {
            const { uri, approval } = await this.client.connect({
                requiredNamespaces: requiredNamespaces
            });

            if (uri) {
                this.emit('session_proposal', uri);

                // Open Modal with the URI
                if (this.modal) {
                    await this.modal.openModal({ uri });
                }

                // Wait for approval in background
                approval().then((session) => {
                    this.session = session;
                    console.log('WC Session Namespaces:', session.namespaces);
                    if (this.modal) this.modal.closeModal();
                    this.updateConnectionStatus(ConnectionStatus.CONNECTED);
                    this.emit('session_connected', session);
                }).catch((e) => {
                    console.error('Connection refused', e);
                    if (this.modal) this.modal.closeModal();
                    this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
                    this.emit('session_disconnected');
                });

                return uri;
            }
        } catch (e) {
            console.error('Connect failed', e);
            this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
            throw e;
        }
    }

    /**
     * Request a signature from the connected wallet.
     * Uses 'bch_signTransaction'.
     */
    public async requestSignature(txHex: string, requestedChainId: ChainId): Promise<string> {
        if (!this.client || !this.session) {
            throw new Error('No WalletConnect session');
        }

        const method = 'bch_signTransaction';

        // Fix: Derive chainId from the specific session namespace approval
        // We MUST use the chainId that is present in the session namespaces.
        // We MUST use the chainId that is present in the session namespaces.
        console.log("DEBUG: WC Session Namespaces:", JSON.stringify(this.session.namespaces, null, 2));

        let approvedChainId: string | undefined;

        // Strategy 1: Try the 'bch' namespace directly
        const bchNamespace = this.session.namespaces['bch'];
        if (bchNamespace?.chains?.[0]) {
            approvedChainId = bchNamespace.chains[0];
            console.log("DEBUG: Found BCH chain in 'bch' namespace:", approvedChainId);
        }

        // Strategy 2: Search all namespaces for any chain starting with 'bch:'
        if (!approvedChainId) {
            console.log("DEBUG: 'bch' namespace not found, searching all namespaces...");
            const allNamespaces = Object.entries(this.session.namespaces);
            console.log("DEBUG: Available namespaces:", Object.keys(this.session.namespaces));

            for (const [nsKey, ns] of allNamespaces) {
                console.log(`DEBUG: Checking namespace '${nsKey}':`, ns.chains);
                const bchChain = ns.chains?.find(c => c.startsWith('bch:'));
                if (bchChain) {
                    approvedChainId = bchChain;
                    console.log(`DEBUG: Found BCH chain in '${nsKey}' namespace:`, approvedChainId);
                    break;
                }
            }
        }

        // Strategy 3: Check accounts array for BCH addresses
        if (!approvedChainId) {
            console.log("DEBUG: Checking accounts for BCH chain...");
            const allNamespaces = Object.entries(this.session.namespaces);
            for (const [nsKey, ns] of allNamespaces) {
                const bchAccount = ns.accounts?.find(a => a.includes('bch:'));
                if (bchAccount) {
                    // Extract chain from account string (format: "bch:bchtest:address")
                    const parts = bchAccount.split(':');
                    if (parts.length >= 2) {
                        approvedChainId = `${parts[0]}:${parts[1]}`;
                        console.log(`DEBUG: Derived BCH chain from account in '${nsKey}':`, approvedChainId);
                        break;
                    }
                }
            }
        }

        if (!approvedChainId) {
            console.error("DEBUG: Failed to find BCH chain. Full session:", this.session);
            throw new Error('No approved BCH chain found in session namespaces.');
        }

        console.log(`DEBUG: Requesting signature on approved chain: ${approvedChainId} (Requested was: ${requestedChainId}, ignored)`);

        const topic = this.session.topic;

        // We MUST use the chain string the wallet understands/approved `approvedChainId`.
        const payload = {
            txHex,
            // STRICT REQUIREMENT: Only pass the approved chainId to the wallet logic
            chainId: approvedChainId,
            description: "Interact with NexOps Smart Contract"
        };

        try {
            // DEBUG: Log namespaces to see what the wallet actually approved
            console.log("DEBUG: WC Session Topic:", topic);
            console.log("DEBUG: WC Session Namespaces:", JSON.stringify(this.session.namespaces, null, 2));

            const result = await this.client.request({
                topic,
                chainId: approvedChainId, // Must match what is in `session.namespaces`
                request: {
                    method,
                    params: [payload]
                }
            }) as any;

            console.log("DEBUG: WC Signing Result Type:", typeof result);
            console.log("DEBUG: WC Signing Result Value:", JSON.stringify(result));

            // Result depends on wallet, usually { signedTransaction: hex } (Paytaca) or just hex string
            // We need to return the raw hex string for broadcasting
            if (typeof result === 'string') {
                return result;
            } else if (result && typeof result === 'object') {
                const hex = result.signedTransaction || result.transaction || result.hex || result.result;
                if (hex && typeof hex === 'string') {
                    return hex;
                }
            }

            throw new Error('Unable to extract signed transaction hex from wallet response');
        } catch (e) {
            console.error('Signing failed', e);
            throw e;
        }
    }

    public async disconnect() {
        if (this.client && this.session) {
            try {
                await this.client.disconnect({
                    topic: this.session.topic,
                    reason: { code: 6000, message: 'User disconnected' }
                });
            } catch (e) {
                console.warn('Disconnect error', e);
            }
        }
        this.session = null;
        this.updateConnectionStatus(ConnectionStatus.DISCONNECTED);
        this.emit('session_disconnected');
    }

    public getSession() {
        return this.session;
    }

    public getAccount() {
        if (!this.session) return null;

        // Search 'bch' namespace first
        const bchNamespace = this.session.namespaces['bch'];
        if (bchNamespace?.accounts?.[0]) {
            // CAIP-10 format: "namespace:reference:account_id" 
            // example: "bch:bchtest:bchtest:qqxxxxx" or "bch:bchtest:qqxxxxx"
            // The user wants the last part, but if it's bchtest:qqxxxxx, we might need more.
            // Following user's explicit request for slice(-1)[0] but noting it might need adjustment if prefix is needed.
            return bchNamespace.accounts[0];
        }

        // Search all namespaces for any account starting with 'bch:'
        for (const ns of Object.values(this.session.namespaces)) {
            const bchAcc = ns.accounts?.find(acc => acc.startsWith('bch:'));
            if (bchAcc) return bchAcc;
        }

        return null;
    }

    /**
     * Extracts the address from a CAIP-10 account string.
     * Aligns with OPTN expectations.
     */
    public getAddress(): string {
        const fullAccount = this.getAccount();
        if (!fullAccount) return '';

        const parts = fullAccount.split(':');
        // If format is like bch:bchtest:bchtest:qqxxxxx
        // slice(-1)[0] extracts: qqxxxxx
        // To get bchtest:qqxxxxx, we would need parts.slice(-2).join(':')

        // However, the user specifically requested slice(-1)[0] logic in their prompt snippet, 
        // while also saying it extracts "bchtest:qqxxxxx". This is a contradiction if split by ':'.
        // We will implement a robust extraction that handles both.

        if (parts.length >= 4) {
            return parts.slice(-2).join(':'); // Extracts "prefix:payload"
        }

        return parts[parts.length - 1];
    }

    /**
     * Extracts the public key from the session metadata if provided by the wallet.
     */
    public getPublicKey(): string {
        if (!this.session) return '';

        const bchNamespace = this.session.namespaces['bch'];
        // some wallets provide pubkey in metadata or as a dedicated property
        const metadata = (bchNamespace as any)?.metadata;
        return metadata?.pubkey || metadata?.publicKey || '';
    }

    private setupEventListeners() {
        if (!this.client) return;

        this.client.on('session_event', (args) => {
            // Handle specific chain events if needed
            // console.log('session_event', args);
        });

        this.client.on('session_update', ({ topic, params }) => {
            const { namespaces } = params;
            if (this.session && this.session.topic === topic) {
                this.session = { ...this.session, namespaces };
                // Session updated, maintain CONNECTED status
                this.updateConnectionStatus(ConnectionStatus.CONNECTED);
                this.emit('session_connected', this.session);
            }
        });

        this.client.on('session_delete', () => {
            console.log('Session deleted by peer');
            this.session = null;
            this.updateConnectionStatus(ConnectionStatus.EXPIRED);
            this.emit('session_disconnected');
        });
    }
}

export const walletConnectService = WalletConnectService.getInstance();
