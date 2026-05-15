export interface FunctionMeta {
    name: string;
    role: string;
    invariants: string[];
}

/** Matches wizard-emitted comments before each CashScript function. */
const FN_RE =
    /\/\/ @nexops-function (\w+): role=([\w-]+)\n(?:[ \t]*\/\/ @nexops-invariants: ([^\n]+)\n)?/g;

export function parseFunctionMeta(source: string): Record<string, FunctionMeta> {
    const result: Record<string, FunctionMeta> = {};
    let m: RegExpExecArray | null;
    while ((m = FN_RE.exec(source)) !== null) {
        const name = m[1];
        const role = m[2];
        const invs = m[3]
            ? m[3]
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
            : [];
        result[name] = { name, role, invariants: invs };
    }
    return result;
}
