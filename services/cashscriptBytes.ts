/**
 * CashScript `bytes` ABI values from UI / manifest strings.
 * - `0x` prefix → hex decode
 * - otherwise → UTF-8 encode (matches wizard digest tooling using TextEncoder)
 */
export function cashscriptBytesFromString(raw: string): Uint8Array {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) {
        return new Uint8Array();
    }
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
        const hex = trimmed.slice(2);
        if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
            throw new Error('Invalid 0x-prefixed hex for bytes argument');
        }
        const pairs = hex.match(/.{1,2}/g);
        return new Uint8Array((pairs ?? []).map((b) => parseInt(b, 16)));
    }
    return new TextEncoder().encode(trimmed);
}
