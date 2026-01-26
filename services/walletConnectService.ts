
import SignClient from '@walletconnect/sign-client';
import { SessionTypes } from '@walletconnect/types';
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
        methods: ['bch_signTransaction', 'bch_signMessage'],
        events: ['chainChanged', 'accountsChanged']
    }
};

export type ChainId = string;

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
    private session: SessionTypes.Struct | null = null;
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

            this.setupEventListeners();

            // Check for restored session (optional, but we prefer ephemeral for this flow)
            if (this.client.session.length) {
                const lastSession = this.client.session.get(this.client.session.keys[this.client.session.keys.length - 1]);
                this.session = lastSession;
                this.emit('session_connected', lastSession);
            }

        } catch (e) {
            console.error('WalletConnect init failed', e);
        }
    }

    /**
     * Starts the connection flow. Returns the URI for the QR code.
     */
    public async connect(validChainId: ChainId): Promise<string | undefined> {
        if (!this.client) await this.init();
        if (!this.client) throw new Error('WalletConnect Client not initialized');

        // unique chain required 
        const requiredNamespaces = {
            bch: {
                methods: CHAIN_NAMESPACES.bch.methods,
                events: CHAIN_NAMESPACES.bch.events,
                chains: [validChainId]
            }
        };

        try {
            const { uri, approval } = await this.client.connect({
                requiredNamespaces: requiredNamespaces
            });

            if (uri) {
                this.emit('session_proposal', uri);

                // Wait for approval in background
                approval().then((session) => {
                    this.session = session;
                    this.emit('session_connected', session);
                }).catch((e) => {
                    console.error('Connection refused', e);
                    this.emit('session_disconnected');
                });

                return uri;
            }
        } catch (e) {
            console.error('Connect failed', e);
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
        // Wallets often return 'bch:testnet' even if we asked for 'bch:chipnet' (or vice versa)
        // We MUST use the chainId that is present in the session namespaces.
        const namespace = this.session.namespaces['bch'];
        console.log("DEBUG: WC Session Namespaces:", this.session.namespaces);

        let approvedChainId = namespace?.chains?.[0];

        // Fallback: If 'bch' namespace is missing or empty, look for any namespace containing 'bch:'
        if (!approvedChainId) {
            const allNamespaces = Object.values(this.session.namespaces);
            for (const ns of allNamespaces) {
                const bchChain = ns.chains?.find(c => c.startsWith('bch:'));
                if (bchChain) {
                    approvedChainId = bchChain;
                    break;
                }
            }
        }

        if (!approvedChainId) {
            throw new Error('No approved BCH chain found in session namespaces.');
        }

        console.log(`DEBUG: Requesting signature on approved chain: ${approvedChainId} (Requested was: ${requestedChainId})`);

        const topic = this.session.topic;

        // Even though we might have asked for 'chipnet', we must use the chain string the wallet understands/approved.
        // The payload usually still needs the functional chain details, but the WC request wrapper needs strict matching.
        const payload = {
            txHex,
            // We pass the *approved* chainId to the wallet logic so it matches the request wrapper context
            chainId: approvedChainId,
            description: "Deploy CashScript contract via NexOps"
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
            });

            // Result depends on wallet, usually { signedTransaction: hex } or just hex string
            // Paytaca usually returns the full transaction hex
            return result as string;
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
        this.emit('session_disconnected');
    }

    public getSession() {
        return this.session;
    }

    public getAccount() {
        return this.session?.namespaces['bch']?.accounts[0] || null;
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
                this.emit('session_connected', this.session);
            }
        });

        this.client.on('session_delete', () => {
            this.session = null;
            this.emit('session_disconnected');
        });
    }
}

export const walletConnectService = WalletConnectService.getInstance();
