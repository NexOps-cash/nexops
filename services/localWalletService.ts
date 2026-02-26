import {
    encodePrivateKeyWif,
    decodePrivateKeyWif,
    sha256,
    instantiateSecp256k1,
    instantiateRipemd160,
    encodeCashAddress
} from '@bitauth/libauth';

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
}

export default LocalWalletService;
