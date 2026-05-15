/**
 * Encode `nSequence` for BIP68-style block-based relative timelock (`this.age` in CashScript).
 * SDK treats this as block count for CSV spends (see CashScript TransactionBuilder).
 */

const SEQUENCE_LOCKTIME_TYPE_FLAG = 1 << 22;

export function csvEncodedSequenceBlocks(blocks: number): number {
    if (!Number.isFinite(blocks) || blocks <= 0 || blocks > 0xffff) {
        throw new Error(`CSV blocks must be in (0, 65535]; got ${blocks}`);
    }
    return (blocks | SEQUENCE_LOCKTIME_TYPE_FLAG) >>> 0;
}
