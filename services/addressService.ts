import { Contract, ElectrumNetworkProvider, Network } from 'cashscript';
import { ContractArtifact } from './compilerService';

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
        // ✅ Correct network enum usage
        console.log('🔍 [addressService] Creating provider...');
        const provider = new ElectrumNetworkProvider(network);
        console.log('🔍 [addressService] Provider created:', provider);

        // ✅ Type constructor arguments
        console.log('🔍 [addressService] Typing arguments...');
        const typedArgs = artifact.constructorInputs.map((inp, i) => {
            const val = args[i];
            console.log(`🔍 [addressService]   Input[${i}]: ${inp.name} (${inp.type}) = ${val}`);
            if (inp.type.startsWith('int')) {
                const bigIntVal = BigInt(val);
                console.log(`🔍 [addressService]   Converted to BigInt: ${bigIntVal}`);
                return bigIntVal;
            }
            return val;
        });
        console.log('🔍 [addressService] Typed args:', typedArgs);

        // ✅ Correct Contract constructor signature (v0.13+)
        console.log('🔍 [addressService] Creating Contract instance...');
        const contract = new Contract(
            artifact as any,
            typedArgs,
            { provider }
        );
        console.log('🔍 [addressService] Contract created:', contract);
        console.log('🔍 [addressService] Contract.address:', contract.address);

        if (!contract.address) {
            throw new Error('Contract created but address is undefined!');
        }

        console.log('✅ [addressService] SUCCESS! Address:', contract.address);
        return contract.address;
    } catch (e) {
        console.error('❌ [addressService] DERIVATION ERROR:', e);
        console.error('❌ [addressService] Error stack:', (e as Error).stack);
        throw e;
    }
}
