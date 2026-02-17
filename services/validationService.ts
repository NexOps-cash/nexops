import { hexToBin, secp256k1 } from '@bitauth/libauth';

export interface ValidationResult {
    isValid: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

/**
 * Validates a pubkey (compressed secp256k1)
 * - Must be 33 bytes (66 hex chars)
 * - Must start with 02 or 03
 * - Must be on the secp256k1 curve
 */
export function validatePubkey(hexString: string): ValidationResult {
    // Remove 0x prefix if present
    const cleaned = hexString.toLowerCase().replace(/^0x/, '');

    // Check length
    if (cleaned.length !== 66) {
        return {
            isValid: false,
            severity: 'error',
            message: `Invalid length: ${cleaned.length} chars (expected 66)`
        };
    }

    // Check prefix
    if (!cleaned.startsWith('02') && !cleaned.startsWith('03')) {
        return {
            isValid: false,
            severity: 'error',
            message: 'Compressed pubkey must start with 02 or 03'
        };
    }

    // Check hex validity
    if (!/^[0-9a-f]+$/.test(cleaned)) {
        return {
            isValid: false,
            severity: 'error',
            message: 'Contains invalid hex characters'
        };
    }

    // Validate on curve using libauth
    try {
        const pubkeyBytes = hexToBin(cleaned);
        const isOnCurve = secp256k1.validatePublicKey(pubkeyBytes);

        if (!isOnCurve) {
            return {
                isValid: false,
                severity: 'warning',
                message: 'Pubkey is not on secp256k1 curve (may be test data)'
            };
        }

        return {
            isValid: true,
            severity: 'info',
            message: 'Valid compressed pubkey'
        };
    } catch (e) {
        return {
            isValid: false,
            severity: 'error',
            message: `Curve validation failed: ${(e as Error).message}`
        };
    }
}

/**
 * Validates an integer input
 */
export function validateInt(value: string, type: string): ValidationResult {
    try {
        const num = BigInt(value);

        // Check for negative if unsigned
        if (type.includes('uint') && num < 0n) {
            return {
                isValid: false,
                severity: 'error',
                message: 'Unsigned integers cannot be negative'
            };
        }

        return {
            isValid: true,
            severity: 'info',
            message: 'Valid integer'
        };
    } catch (e) {
        return {
            isValid: false,
            severity: 'error',
            message: 'Not a valid integer'
        };
    }
}

/**
 * Master validation function for constructor arguments
 */
export function validateConstructorArg(
    value: string,
    type: string,
    name: string
): ValidationResult {
    if (type === 'pubkey') {
        return validatePubkey(value);
    }

    if (type.startsWith('int') || type.startsWith('uint')) {
        return validateInt(value, type);
    }

    // Default: allow strings/bytes without validation
    return {
        isValid: true,
        severity: 'info',
        message: 'No validation required'
    };
}
