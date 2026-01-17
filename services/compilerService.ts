import { compileString } from 'cashc';

export interface CompilationResult {
    success: boolean;
    artifact?: any;
    errors: string[];
}

export const compileCashScript = (code: string): CompilationResult => {
    try {
        // basic check to avoid crashes on empty
        if (!code.trim()) {
            return { success: false, errors: ["Code is empty"] };
        }

        const artifact = compileString(code);
        return {
            success: true,
            artifact: artifact,
            errors: []
        };
    } catch (e: any) {
        // Cashc throws errors with message strings
        // We want to capture them
        return {
            success: false,
            errors: [e.message || "Unknown compilation error"]
        };
    }
};
