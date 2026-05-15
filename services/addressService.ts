import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import { encodeCashAddress } from '@bitauth/libauth';
import { ContractArtifact } from '../types';
import { ELECTRUM_FALLBACK_SERVERS } from './blockchainService';
import { normalizeChipnetCashAddress } from './chipnetCashAddr';

/**
 * Coerce raw string constructor args to the correct JS types needed by cashscript.
 * - int/uint  → BigInt
 * - bytesN    → Uint8Array (padded to N bytes)
 * - pubkey    → Uint8Array (from hex)
 * - everything else → string (unchanged)
 */
export function coerceConstructorArgs(
    inputs: { name: string; type: string }[],
    args: string[]
): (bigint | Uint8Array | string)[] {
    return inputs.map((inp, i) => {
        const val = args[i] ?? '';
        if (inp.type.startsWith('int') || inp.type.startsWith('uint')) {
            return BigInt(val || '0');
        }
        if (inp.type === 'pubkey') {
            if (val && /^[0-9a-fA-F]{66}$/.test(val)) {
                return new Uint8Array(val.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
            }
        }
        // Fixed-size bytesN (bytes20, bytes32, etc.) — NOT bare 'bytes'
        const bytesNMatch = inp.type.match(/^bytes(\d+)$/);
        if (bytesNMatch) {
            const size = parseInt(bytesNMatch[1], 10);
            const expectedHexChars = size * 2;
            const hexRaw = String(val ?? '').trim().replace(/^0x/i, '');
            if (!hexRaw) {
                throw new Error(
                    `Constructor "${inp.name}" (${inp.type}) is empty. Use the wallet picker for PKH/bytes20 fields or paste ${expectedHexChars} hex characters.`,
                );
            }
            if (!/^[0-9a-fA-F]+$/.test(hexRaw)) {
                throw new Error(
                    `Constructor "${inp.name}" (${inp.type}) must contain only hexadecimal characters.`,
                );
            }
            if (hexRaw.length > expectedHexChars) {
                throw new Error(
                    `Constructor "${inp.name}" (${inp.type}) has ${hexRaw.length} hex digits; maximum is ${expectedHexChars}.`,
                );
            }
            const paddedHex = hexRaw.padStart(expectedHexChars, '0');
            return new Uint8Array(paddedHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
        }
        return val;
    });
}

function lockingBytecodeHexToUint8Array(hexRaw: string): Uint8Array {
    const s = hexRaw.trim().replace(/^0x/i, '');
    if (!s.length || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) {
        throw new Error('Invalid locking bytecode hex');
    }
    return new Uint8Array(s.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

/** Standard P2PKH locking bytecode (OP_DUP OP_HASH160 … OP_EQUALVERIFY OP_CHECKSIG). */
export function chipnetLockingBytecodeToP2pkhAddress(lockingBytecode: Uint8Array): string {
    const lb = lockingBytecode;
    if (
        lb.length !== 25 ||
        lb[0] !== 0x76 ||
        lb[1] !== 0xa9 ||
        lb[2] !== 0x14 ||
        lb[23] !== 0x88 ||
        lb[24] !== 0xac
    ) {
        throw new Error(
            'Expected standard P2PKH locking bytecode for seller payout (NexOps escrow uses hex like 76a914…88ac).'
        );
    }
    const pkh = lb.slice(3, 23);
    const { address } = encodeCashAddress({ prefix: 'bchtest', type: 'p2pkh', payload: pkh });
    try {
        return normalizeChipnetCashAddress(address);
    } catch {
        return address;
    }
}

/** CashAddr paid by `complete` / `arbitrateToSeller` — must match constructor `sellerLockingBytecode`. */
export function arbitrationEscrowSellerPayoutAddress(
    artifact: ContractArtifact,
    constructorArgStrings: string[]
): string {
    if (artifact.contractName !== 'ArbitrationEscrow') {
        throw new Error('arbitrationEscrowSellerPayoutAddress: not ArbitrationEscrow');
    }
    const idx = artifact.constructorInputs.findIndex((i) => i.name === 'sellerLockingBytecode');
    if (idx < 0) throw new Error('artifact missing sellerLockingBytecode');
    const coerced = coerceConstructorArgs(artifact.constructorInputs, constructorArgStrings)[idx];
    const bytes =
        coerced instanceof Uint8Array ? coerced : lockingBytecodeHexToUint8Array(String(coerced ?? ''));
    return chipnetLockingBytecodeToP2pkhAddress(bytes);
}

/**
 * Derives the Chipnet receive address shown by wallets like Paytaca.
 * Uses the token-aware CashAddr (`Contract.tokenAddress`), not the shorter legacy encoding (`Contract.address`).
 */
export function deriveContractAddress(
    artifact: ContractArtifact,
    args: string[],
    network: Network = Network.CHIPNET
): string {
    console.log('🔍 [addressService] DERIVATION START');
    console.log('🔍 [addressService] Artifact:', {
        name: artifact.contractName,
        hasAbi: !!artifact.abi,
        abiLength: artifact.abi?.length,
        hasBytecode: !!artifact.bytecode,
        bytecodeLength: artifact.bytecode?.length,
        constructorInputs: artifact.constructorInputs
    });
    console.log('🔍 [addressService] Raw args:', args);
    console.log('🔍 [addressService] Network:', network);

    const typedArgs = coerceConstructorArgs(artifact.constructorInputs, args);

    const tryWithProvider = (provider: ElectrumNetworkProvider): string => {
        const contract = new Contract(artifact as any, typedArgs, { provider });
        const paymentAddress = contract.tokenAddress ?? contract.address;
        if (!paymentAddress) {
            throw new Error('Contract created but address is undefined!');
        }
        if (network === Network.CHIPNET) {
            try {
                return normalizeChipnetCashAddress(paymentAddress);
            } catch (e) {
                console.warn('[addressService] Chipnet address normalization failed, using raw:', e);
                return paymentAddress;
            }
        }
        return paymentAddress;
    };

    try {
        if (network === Network.CHIPNET) {
            let lastErr: unknown;
            for (const hostname of ELECTRUM_FALLBACK_SERVERS) {
                try {
                    const provider = new ElectrumNetworkProvider(network, { hostname });
                    return tryWithProvider(provider);
                } catch (e) {
                    lastErr = e;
                    console.warn(`[addressService] Chipnet Electrum host failed (${hostname}):`, e);
                }
            }
            console.error('❌ [addressService] All Chipnet Electrum hosts failed:', lastErr);
            throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
        }

        const provider = new ElectrumNetworkProvider(network);
        return tryWithProvider(provider);
    } catch (e) {
        console.error('❌ [addressService] DERIVATION ERROR:', e);
        console.error('❌ [addressService] Error stack:', (e as Error).stack);
        throw e;
    }
}

/**
 * Turn low-level ABI / Electrum failures into actionable copy for the deployment UI.
 */
export function explainDerivationError(error: unknown, inputs: { name: string; type: string }[]): string {
    const raw = error instanceof Error ? error.message : String(error);

    const bytesInputs = inputs.filter((i) => /^bytes\d+$/.test(i.type));
    if (/bytes0.*bytes20|type 'bytes0'|found type 'bytes0'/i.test(raw)) {
        const hint =
            bytesInputs.length > 0
                ? bytesInputs.map((i) => `"${i.name}" (${i.type})`).join(', ')
                : 'every bytes20 / bytes32 / … constructor field';
        return (
            `Address derivation failed: ${hint} must be filled with valid hex (empty values become bytes0 instead of fixed-width hex). PKH/hash fields usually need exactly 40 hex characters for bytes20.` +
                `\n\nTechnical detail: ${raw}`
        );
    }

    const electrumBroken = raw.includes('All Chipnet Electrum hosts failed') || /ENOTFOUND|EAI_|ECONN|timeout/i.test(raw);
    if (electrumBroken) {
        return (
            `${raw}\n\nIf your constructor args look correct, the Chipnet indexer may be unavailable — retry in a minute or refresh the page.`
        );
    }

    return raw;
}
