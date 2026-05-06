import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import { ContractArtifact } from '../types';

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

    try {
        console.log('🔍 [addressService] Creating provider...');
        const provider = new ElectrumNetworkProvider(network);
        console.log('🔍 [addressService] Provider created:', provider);

        console.log('🔍 [addressService] Typing arguments...');
        const typedArgs = coerceConstructorArgs(artifact.constructorInputs, args);
        console.log('🔍 [addressService] Typed args:', typedArgs);

        console.log('🔍 [addressService] Creating Contract instance...');
        const contract = new Contract(
            artifact as any,
            typedArgs,
            { provider }
        );
        console.log('🔍 [addressService] Contract created:', contract);
        console.log('🔍 [addressService] Contract.address:', contract.address);
        console.log('🔍 [addressService] Contract.tokenAddress:', contract.tokenAddress);

        const paymentAddress = contract.tokenAddress ?? contract.address;
        if (!paymentAddress) {
            throw new Error('Contract created but address is undefined!');
        }

        console.log('✅ [addressService] SUCCESS! Payment address:', paymentAddress);
        return paymentAddress;
    } catch (e) {
        console.error('❌ [addressService] DERIVATION ERROR:', e);
        console.error('❌ [addressService] Error stack:', (e as Error).stack);
        throw e;
    }
}
