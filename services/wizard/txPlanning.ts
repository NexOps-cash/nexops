import type { ContractArtifact } from '../../types';
import type { FunctionMeta } from './parseContractMeta';

export type OutputStrategy =
    | { kind: 'sweep-to-wallet' }
    | { kind: 'value-preserving-to-self' }
    | { kind: 'exact-input-value-to-wallet' }
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
    if (invs.has('INPUT_OUTPUT_VALUE_MATCH')) {
        return { kind: 'exact-input-value-to-wallet' };
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

/**
 * `ArbitrationEscrow` `complete` / `arbitrateToSeller` with `releaseCapSats == 0` requires:
 * `tx.outputs[0].value == tx.inputs[this.activeInputIndex].value` (one contract input per tx) and pays **no** fee from that output.
 * CLI (`runChipnetFlow`) switches to `exact-input-value-to-wallet` + P2PKH fee sponsor — sweep-minus-fee would fail script checks.
 */
export function escrowSellerExactInputPath(
    artifact: ContractArtifact,
    functionName: string,
    constructorStrings: string[]
): boolean {
    if (artifact.contractName !== 'ArbitrationEscrow') return false;
    if (functionName !== 'complete' && functionName !== 'arbitrateToSeller') return false;
    const capIdx = artifact.constructorInputs.findIndex((i) => i.name === 'releaseCapSats');
    if (capIdx < 0) return false;
    const cap = Number(constructorStrings[capIdx] ?? '0');
    return Number.isFinite(cap) && cap === 0;
}

export function estimateFee(inputCount: number, outputCount: number): bigint {
    return BigInt(10 + inputCount * 300 + outputCount * 34);
}

/** Absolute floor for tiny spends — superseded by {@link chipnetFootprintRelayFloor} when inputs add bulk. */
export const CHIPNET_MIN_RELAY_FEE_SATS = 1200n;

/**
 * Chipnet fee sizing from serialized footprint (~1.15 sat/vbyte margin). Used for relay floors and minimum sponsor value.
 */
export function estimateChipnetRelayFootprintFeeSats(inputCount: number, outputCount: number): bigint {
    const ins = Math.max(1, inputCount);
    const outs = Math.max(1, outputCount);
    const estimatedBytes = 200 + ins * 950 + outs * 55;
    return (BigInt(estimatedBytes) * 115n) / 100n;
}

/** Effective miner fee for preview + broadcast on Chipnet (non–IOVM spends use size-aware floor). */
export function effectiveRelayFeeSats(
    strategy: OutputStrategy,
    inputCount: number,
    outputCount: number,
    network?: string
): bigint {
    const base = feeForStrategy(strategy, inputCount, outputCount);
    const chipnet = (network ?? '').toLowerCase() === 'chipnet';
    if (!chipnet || strategy.kind === 'exact-input-value-to-wallet') {
        return base;
    }
    const staticFloor = base >= CHIPNET_MIN_RELAY_FEE_SATS ? base : CHIPNET_MIN_RELAY_FEE_SATS;
    const sizeFloor = estimateChipnetRelayFootprintFeeSats(inputCount, outputCount);
    return staticFloor > sizeFloor ? staticFloor : sizeFloor;
}

/** Fee for a planned spend; multisig-style INPUT_OUTPUT_VALUE_MATCH uses zero fee (output must equal input). */
export function feeForStrategy(
    strategy: OutputStrategy,
    inputCount: number,
    outputCount: number
): bigint {
    if (strategy.kind === 'exact-input-value-to-wallet') {
        return 0n;
    }
    return estimateFee(inputCount, outputCount);
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
        case 'exact-input-value-to-wallet': {
            if (fee !== 0n) {
                throw new Error(
                    'exact-input-value-to-wallet requires zero fee so output value equals contract input'
                );
            }
            if (totalInput <= 0n) {
                throw new Error('Insufficient funds for value-preserving spend');
            }
            return [{ to: walletAddress, amount: totalInput }];
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
