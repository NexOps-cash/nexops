import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import { ContractArtifact } from '../types';
import { ELECTRUM_FALLBACK_SERVERS } from './blockchainService';

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
            if (val && /^[0-9a-fA-F]+$/.test(val)) {
                const paddedHex = val.padStart(size * 2, '0');
                return new Uint8Array(paddedHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
            }
        }
        return val;
    });
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
