
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
import { WalletConnectModal } from '@walletconnect/modal';
import { EventEmitter } from 'events';
import { Buffer } from 'buffer';
import {
    binToHex,
    secp256k1,
    sha256,
    hexToBin
} from '@bitauth/libauth';

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
     * Uses 'bch_signTransaction' with TransactionCommon and sourceOutputs.
     */
    public async requestSignature(
        transaction: any,
        sourceOutputs: any[],
        requestedChainId: string
    ): Promise<string> {
        if (!this.client || !this.session) {
            throw new Error('No WalletConnect session');
        }

        const bchNamespace = this.session.namespaces['bch'];
        if (!bchNamespace?.chains?.[0]) {
            throw new Error('No approved BCH chain in session');
        }

        const approvedChainId = bchNamespace.chains[0];
        const topic = this.session.topic;

        console.log("WC DEBUG: Using chainId:", approvedChainId);
        console.log("WC DEBUG: Sending transaction template:", transaction);
        console.log("WC DEBUG: Sending sourceOutputs:", sourceOutputs);

        try {
            const result = await this.client.request({
                topic,
                chainId: approvedChainId,
                request: {
                    method: 'bch_signTransaction',
                    params: {
                        transaction,
                        sourceOutputs,
                        broadcast: false,
                        userPrompt: "Sign NexOps Smart Contract Transaction"
                    }
                }
            }) as any;

            console.log("WC DEBUG: Wallet response:", result);

            if (typeof result === 'string') {
                return result;
            }

            if (result?.signedTransaction) {
                return result.signedTransaction;
            }

            if (result?.result?.signedTransaction) {
                return result.result.signedTransaction;
            }

            if (result?.transaction) {
                return result.transaction;
            }

            throw new Error('Unable to extract signed transaction from wallet response');
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
     * Some wallets (Paytaca) provide it in namespace metadata, others in peer metadata.
     */
    public getPublicKey(): string {
        if (!this.session) return '';

        console.log("WC DEBUG: Searching for Pubkey in session:", JSON.stringify(this.session.namespaces, null, 2));

        // Strategy 1: Search all namespaces for metadata.pubkey
        for (const [nsKey, ns] of Object.entries(this.session.namespaces)) {
            const pk = (ns as any)?.metadata?.pubkey || (ns as any)?.metadata?.publicKey;
            if (pk) {
                console.log(`WC DEBUG: Found Pubkey in namespace '${nsKey}':`, pk);
                return pk;
            }
        }

        // Strategy 2: Check peer metadata (global)
        const peerMetadata = this.session.peer?.metadata as any;
        const peerPk = peerMetadata?.pubkey || peerMetadata?.publicKey;
        if (peerPk) {
            console.log("WC DEBUG: Found Pubkey in peer metadata:", peerPk);
            return peerPk;
        }

        // Strategy 3: Check for Paytaca-specific session extensions if any
        // (Sometimes wallets put it in custom keys at the root of the namespace)
        const bchNS = this.session.namespaces['bch'] as any;
        if (bchNS?.pubkey || bchNS?.publicKey) {
            return bchNS.pubkey || bchNS.publicKey;
        }

        console.warn("WC DEBUG: No public key found in session metadata.");
        return '';
    }

    /**
     * Derives the public key by requesting a message signature from the wallet.
     * Works even if the wallet doesn't provide the pubkey in session metadata.
     */
    public async derivePublicKeyFromWallet(): Promise<string> {
        if (!this.client || !this.session) {
            throw new Error('No WalletConnect session');
        }

        const bchNamespace = this.session.namespaces['bch'];
        const chainId = bchNamespace?.chains?.[0];
        const topic = this.session.topic;

        const account = this.getAddress();
        if (!account) {
            throw new Error('No wallet account found');
        }

        const challenge = `NexOps PubKey Derivation Challenge ${Date.now()}`;

        console.log("WC DEBUG: Requesting message signature for pubkey derivation...");
        const signatureBase64 = await this.client.request({
            topic,
            chainId,
            request: {
                method: 'bch_signMessage',
                params: {
                    account,
                    message: challenge
                }
            }
        }) as string;

        // Convert base64 → Uint8Array
        const signatureBytes = new Uint8Array(Buffer.from(signatureBase64, 'base64'));

        // Strategy 1: Standard double-SHA256 (Simple)
        const messageHash = sha256.hash(
            sha256.hash(new TextEncoder().encode(challenge))
        );

        try {
            console.log("WC DEBUG: Attempting pubkey recovery (Standard hash)...");
            // Note: signatureBytes might include recovery ID in first byte (Bitcoin style)
            // or Libauth might handle the 65-byte format depending on version.
            const recovery = (secp256k1 as any).recoverPublicKeyCompressed(
                signatureBytes,
                messageHash
            );
            if (typeof recovery !== 'string' && recovery) {
                return binToHex(recovery);
            }
        } catch (e) {
            console.warn("WC DEBUG: Standard recovery failed, trying Bitcoin Signed Message format...", e);
        }

        // Strategy 2: Bitcoin Signed Message Format (Robust)
        // Format: "\x18Bitcoin Signed Message:\n" + varint(len(message)) + message
        const prefix = "\x18Bitcoin Signed Message:\n";
        const messageEncoded = new TextEncoder().encode(challenge);

        // Simple varint for small lengths
        const varint = messageEncoded.length < 253
            ? new Uint8Array([messageEncoded.length])
            : new Uint8Array([253, messageEncoded.length & 0xff, (messageEncoded.length >> 8) & 0xff]);

        const fullMessage = new Uint8Array(prefix.length + varint.length + messageEncoded.length);
        fullMessage.set(new TextEncoder().encode(prefix), 0);
        fullMessage.set(varint, prefix.length);
        fullMessage.set(messageEncoded, prefix.length + varint.length);

        const robustHash = sha256.hash(sha256.hash(fullMessage));

        console.log("WC DEBUG: Attempting pubkey recovery (Robust hash)...");
        const recoveryRobust = (secp256k1 as any).recoverPublicKeyCompressed(
            signatureBytes,
            robustHash
        );

        if (typeof recoveryRobust === 'string' || !recoveryRobust) {
            throw new Error(`PubKey recovery failed: ${recoveryRobust || 'Unknown error'}`);
        }

        return binToHex(recoveryRobust);
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
