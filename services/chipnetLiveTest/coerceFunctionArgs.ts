import { HashType, SignatureAlgorithm, SignatureTemplate } from 'cashscript';
import type { ContractArtifact } from '../../types';
import { cashscriptBytesFromString } from '../cashscriptBytes';

export function getAbiFunction(artifact: ContractArtifact, name: string): {
    name: string;
    inputs: { name: string; type: string }[];
} {
    const fns = artifact.abi.filter((item: any) => item.type === 'function' || !item.type);
    const fn = fns.find((f: any) => f.name === name);
    if (!fn) {
        throw new Error(`ABI function not found: ${name}`);
    }
    return fn as { name: string; inputs: { name: string; type: string }[] };
}

/** Mirrors TransactionBuilder typed-arg coercion for local (burner) signing. */
export function coerceAbiFunctionArgs(
    fn: { inputs: { name: string; type: string }[] },
    stringArgs: string[],
    wif: string
): unknown[] {
    return fn.inputs.map((def, i) => {
        const raw = stringArgs[i] ?? '';

        if (def.type === 'sig') {
            return new SignatureTemplate(wif, HashType.SIGHASH_ALL, SignatureAlgorithm.ECDSA);
        }
        if (def.type === 'int') {
            const val = raw || '0';
            if (Number.isNaN(Number(val))) {
                throw new Error(`Invalid integer for ${def.name}`);
            }
            return BigInt(val);
        }
        if (def.type === 'bool') {
            return raw === 'true';
        }
        if (def.type === 'bytes') {
            return cashscriptBytesFromString(raw);
        }
        if (def.type === 'pubkey') {
            if (raw && /^[0-9a-fA-F]{66}$/.test(raw)) {
                return new Uint8Array(raw.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
            }
            throw new Error(`Invalid pubkey hex for ${def.name} (expect 66 hex chars)`);
        }
        return raw;
    });
}
