import { compileString } from 'cashc';
import { ContractArtifact } from '../types';

export interface CompilationResult {
    success: boolean;
    artifact?: ContractArtifact;
    errors: string[];
}

// Simple helper to calculate a mock script hash if missing (SHA-256 slice for visual consistency in demo)
// In production, use libauth/bitauth-lib for real HASH160
async function deriveScriptHash(bytecode: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(bytecode);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 40); // 20 bytes hex
}

export const compileCashScript = (code: string): CompilationResult => {
    try {
        if (!code.trim()) {
            return { success: false, errors: ["Code is empty"] };
        }

        const artifactRaw = compileString(code) as any;
        console.log("🛠️ compilerService RAW output:", artifactRaw);

        // Check for compiler errors in the returned object
        if (artifactRaw.errors && artifactRaw.errors.length > 0) {
            return {
                success: false,
                errors: artifactRaw.errors.map((e: any) =>
                    typeof e === 'string' ? e : (e.message || JSON.stringify(e))
                )
            };
        }

        // If bytecode is missing, it's not a valid compilation result
        if (!artifactRaw.bytecode) {
            return {
                success: false,
                errors: ["Compilation failed: No bytecode generated"]
            };
        }

        // map raw artifact to our clean interface
        const artifact: ContractArtifact = artifactRaw;

        return {
            success: true,
            artifact: artifact,
            errors: []
        };
    } catch (e: any) {
        return {
            success: false,
            errors: [e.message || "Unknown compilation error"]
        };
    }
};

export const verifyDeterminism = async (code: string, originalBytecode: string): Promise<boolean> => {
    const result = compileCashScript(code);
    if (!result.success || !result.artifact) return false;
    return result.artifact.bytecode === originalBytecode;
};

export const calculateScriptHash = async (bytecode: string): Promise<string> => {
    return deriveScriptHash(bytecode);
};
