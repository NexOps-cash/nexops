import { TransactionBuilder, ElectrumNetworkProvider, Network, placeholderP2PKHUnlocker } from 'cashscript';
import { walletConnectService } from './walletConnectService';
import { fetchUTXOsWithTimeout, getElectrumConnectionSnapshot, ELECTRUM_FALLBACK_SERVERS } from './blockchainService';
import { normalizeChipnetCashAddress } from './chipnetCashAddr';

/** Chipnet relay — conservative sats/byte for CashScript fee + change sizing */
const FEE_RATE_SATS_PER_BYTE = 3;

function normalizeAddr(addr: string): string {
    try {
        return normalizeChipnetCashAddress(addr.trim());
    } catch {
        return addr.trim();
    }
}

/**
 * Build a P2PKH → contract payment via CashScript placeholders and WalletConnect signing.
 * Uses {@link stringify}-compatible WC params and NexOps broadcast after signing (same as Transaction Builder spends).
 */
export async function fundContractFromWalletConnect(params: {
    fromCashAddress: string;
    contractCashAddress: string;
    amountSats: bigint;
}): Promise<string> {
    const from = normalizeAddr(params.fromCashAddress);
    const to = normalizeAddr(params.contractCashAddress);

    const utxos = await fetchUTXOsWithTimeout(from);
    if (!utxos.length) {
        throw new Error(
            'No UTXOs at your WalletConnect address on Chipnet. Fund that address first (e.g. faucet), then retry.'
        );
    }

    const sorted = [...utxos].sort((a, b) => b.value - a.value);
    const unlocker = placeholderP2PKHUnlocker(from);
    const host = getElectrumConnectionSnapshot().host ?? ELECTRUM_FALLBACK_SERVERS[0];
    const provider = new ElectrumNetworkProvider(Network.CHIPNET, { hostname: host });

    let lastErr: unknown = null;
    for (let i = 0; i < sorted.length; i++) {
        const picked = sorted.slice(0, i + 1);
        try {
            const tb = new TransactionBuilder({ provider });
            tb.addInputs(
                picked.map((u) => ({
                    txid: u.txid,
                    vout: u.vout,
                    satoshis: BigInt(u.value),
                })),
                unlocker,
            );
            tb.addOutput({ to, amount: params.amountSats });
            tb.addBchChangeOutputIfNeeded({
                to: from,
                feeRate: FEE_RATE_SATS_PER_BYTE,
            });
            const wcObj = tb.generateWcTransactionObject({
                broadcast: false,
                userPrompt: `Send ${params.amountSats.toString()} satoshis to the contract`,
            });
            const signedHex = await walletConnectService.requestSignature(wcObj);
            const txid = await provider.sendRawTransaction(signedHex);
            return txid;
        } catch (e) {
            lastErr = e;
        }
    }

    const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
    throw new Error(
        `Could not build a funding transaction from your wallet UTXOs (need enough balance for amount + fee). ${msg}`
    );
}
