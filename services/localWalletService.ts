import {
    encodePrivateKeyWif,
    decodePrivateKeyWif,
    sha256,
    instantiateSecp256k1,
    instantiateRipemd160,
    encodeCashAddress
} from '@bitauth/libauth';
import { LocalWallet } from '../types';

// Ephemeral Burner Wallet Service
// STRICTLY NON-CUSTODIAL: Keys are kept purely in React state / memory.

class LocalWalletService {
    /**
     * Generate a cryptographically secure random private key using Web Crypto API
     * and encode it as a testnet WIF.
     */
    static async generateBurnerWIF(): Promise<string> {
        // 1. Generate 32 random bytes for the private key
        const privateKey = new Uint8Array(32);
        crypto.getRandomValues(privateKey);

        // 2. Encode to WIF string
        // 'testnet' prefix is used for Testnet ('c' prefix for WIFs)
        return encodePrivateKeyWif(privateKey, 'testnet');
    }

    /**
     * Derive the testnet CashAddress from a WIF string.
     */
    /**
     * Derive the compressed public key (hex) from a WIF string.
     */
    static async getPublicKeyFromWIF(wif: string): Promise<string> {
        const decoded = decodePrivateKeyWif(wif);
        if (typeof decoded === 'string') {
            throw new Error(`Invalid WIF: ${decoded}`);
        }

        const secp256k1 = await instantiateSecp256k1();
        const pk = secp256k1.derivePublicKeyCompressed(decoded.privateKey);

        if (typeof pk === 'string') {
            throw new Error(`Public Key Derivation Failed: ${pk}`);
        }

        // Return as hex string
        return Array.from(pk).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Derive the testnet CashAddress from a WIF string.
     */
    static async getAddressFromWIF(wif: string): Promise<string> {
        const decoded = decodePrivateKeyWif(wif);
        if (typeof decoded === 'string') {
            throw new Error(`Invalid WIF: ${decoded}`);
        }

        const secp256k1 = await instantiateSecp256k1();
        const ripemd160 = await instantiateRipemd160();

        // Get public key (compressed is standard for modern BCH wallets)
        const pk = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
        if (typeof pk === 'string') {
            throw new Error(`Public Key Derivation Failed: ${pk}`);
        }

        // Hash160 (ripemd160(sha256(pubkey)))
        const hash = ripemd160.hash(sha256.hash(pk));

        // Encode as CashAddress
        const encodeResult = encodeCashAddress({
            prefix: 'bchtest',
            type: 'p2pkh',
            payload: hash
        });

        // Handle both string return (older libauth) and object return (newer libauth v3)
        if (typeof encodeResult === 'string') {
            return encodeResult;
        } else if (encodeResult && typeof encodeResult === 'object' && 'address' in encodeResult) {
            return (encodeResult as any).address;
        }
        throw new Error(JSON.stringify(encodeResult));
    }

    /**
     * Create a full wallet object from a name.
     */
    static async createWallet(name: string): Promise<LocalWallet> {
        const wif = await this.generateBurnerWIF();
        const address = await this.getAddressFromWIF(wif);
        const pubkey = await this.getPublicKeyFromWIF(wif);

        return {
            id: crypto.randomUUID(),
            name,
            wif,
            pubkey,
            address,
            network: 'chipnet'
        };
    }

    /**
     * Derive P2PKH locking bytecode from a compressed public key (hex)
     */
    static async getLockingBytecodeFromPubkey(pubkeyHex: string): Promise<string> {
        const pk = new Uint8Array(pubkeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const ripemd160 = await instantiateRipemd160();
        const hash = ripemd160.hash(sha256.hash(pk));

        // P2PKH: OP_DUP OP_HASH160 <hash160> OP_EQUALVERIFY OP_CHECKSIG
        // Hex: 76 a9 14 <20-byte-hash> 88 ac
        const hashHex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
        return `76a914${hashHex}88ac`;
    }

    /**
     * Derive raw HASH160 (RIPEMD160(SHA256(pubkey))) as a 20-byte hex string.
     * This is what bytes20 / PKH constructor arguments expect.
     */
    static async getPKHFromPubkey(pubkeyHex: string): Promise<string> {
        const pk = new Uint8Array(pubkeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const ripemd160 = await instantiateRipemd160();
        const hash = ripemd160.hash(sha256.hash(pk));
        return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}

export default LocalWalletService;
