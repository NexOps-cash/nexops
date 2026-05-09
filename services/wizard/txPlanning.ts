import type { FunctionMeta } from './parseContractMeta';

export type OutputStrategy =
    | { kind: 'sweep-to-wallet' }
    | { kind: 'value-preserving-to-self' }
    | { kind: 'bound-payout'; note: string }
    | { kind: 'token-mint' }
    | { kind: 'unknown' };

export function deriveOutputStrategy(meta: FunctionMeta): OutputStrategy {
    const invs = new Set(meta.invariants);

    if (meta.role === 'token-mint' && invs.has('TOKEN_CATEGORY_CONTINUITY')) {
        return { kind: 'token-mint' };
    }
    if (meta.role === 'bound-payout' && invs.has('BOUND_RECIPIENT')) {
        return { kind: 'bound-payout', note: 'Recipient enforced by contract.' };
    }
    if (meta.role === 'covenant-continuation' && invs.has('VALUE_PRESERVING_COVENANT')) {
        return { kind: 'value-preserving-to-self' };
    }
    if (
        (meta.role === 'owner-spend' || meta.role === 'owner-escape') &&
        invs.has('OUTPUT_COUNT_CLAMP')
    ) {
        return { kind: 'sweep-to-wallet' };
    }
    if (meta.role === 'quorum-spend') {
        return { kind: 'sweep-to-wallet' };
    }
    return { kind: 'unknown' };
}

export function estimateFee(inputCount: number, outputCount: number): bigint {
    return BigInt(10 + inputCount * 300 + outputCount * 34);
}

export function buildTxOutputs(
    strategy: OutputStrategy,
    totalInput: bigint,
    fee: bigint,
    walletAddress: string,
    contractAddress: string
): Array<{ to: string; amount: bigint }> {
    switch (strategy.kind) {
        case 'value-preserving-to-self': {
            const amt = totalInput - fee;
            if (amt <= 0n) {
                throw new Error(
                    `Insufficient funds: Total selected value (${totalInput} sats) is less than or equal to the fee (${fee} sats).`
                );
            }
            return [{ to: contractAddress, amount: amt }];
        }
        case 'token-mint':
            throw new Error(
                'Token-mint transactions require manual output configuration — coming soon.'
            );
        case 'bound-payout':
        case 'sweep-to-wallet':
        default: {
            const amt = totalInput - fee;
            if (amt <= 0n) {
                throw new Error(
                    `Insufficient funds: Total selected value (${totalInput} sats) is less than or equal to the fee (${fee} sats).`
                );
            }
            return [{ to: walletAddress, amount: amt }];
        }
    }
}
