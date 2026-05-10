/**
 * Fee sponsorship for spends where contract output must equal contract input value
 * (`INPUT_OUTPUT_VALUE_MATCH` / exact-input-value-to-wallet).
 *
 * Multisig and HTLC claim/refund share this path; logic is unchanged from the original multisig fix.
 */

import {
    Contract,
    SignatureTemplate,
    TransactionBuilder as CashScriptTransactionBuilder,
    type ElectrumNetworkProvider,
} from 'cashscript';
import { decodePrivateKeyWif, instantiateSecp256k1, instantiateRipemd160, sha256 } from '@bitauth/libauth';
import type { OutputStrategy } from '../wizard/txPlanning';
import { fetchUTXOs, type UTXO } from '../blockchainService';
import { getP2pkhBridgeArtifact } from './p2pkhBridgeArtifact';

function utxoSetFingerprint(us: UTXO[]): string {
    return [...us]
        .sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout)
        .map((u) => `${u.txid}:${u.vout}:${u.height}:${u.value}`)
        .join('|');
}

/** Two identical Electrum snapshots back-to-back avoids picking coins a funding tx just spent (stale list → mempool conflict). */
async function fetchStableBurnerUtxos(burnerAddress: string): Promise<UTXO[]> {
    let prev = await fetchUTXOs(burnerAddress);
    for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 280));
        const cur = await fetchUTXOs(burnerAddress);
        if (utxoSetFingerprint(prev) === utxoSetFingerprint(cur)) {
            return cur;
        }
        prev = cur;
    }
    return prev;
}

export async function attachBurnerP2pkhSponsorIfNeeded(params: {
    outputStrategy: OutputStrategy;
    txBuilder: CashScriptTransactionBuilder;
    provider: ElectrumNetworkProvider;
    wif: string;
    burnerAddress: string;
    /** Mult-output covenant spends (e.g. LinearVesting claim) still need a fee input. */
    forceSponsor?: boolean;
}): Promise<{ sponsorInputValue: bigint }> {
    const { outputStrategy, txBuilder, provider, wif, burnerAddress, forceSponsor } = params;

    if (outputStrategy.kind !== 'exact-input-value-to-wallet' && !forceSponsor) {
        return { sponsorInputValue: 0n };
    }

    const burnerSpendUtxos: UTXO[] = await fetchStableBurnerUtxos(burnerAddress);
    const bigEnough = burnerSpendUtxos.filter((u) => BigInt(u.value) >= 600n);
    /** Prefer mined sponsor outs so we do not race Electrum 0-conf lists after a funding tx spent overlapping coins */
    const confirmedPool = bigEnough.filter((u) => u.height > 0).sort((a, b) => a.value - b.value);
    const pool = confirmedPool.length > 0 ? confirmedPool : bigEnough.sort((a, b) => a.value - b.value);
    const sponsor = pool[0];
    if (!sponsor) {
        throw new Error('No burner UTXO available to sponsor relay fee for exact-input-value spend');
    }

    const decoded = decodePrivateKeyWif(wif);
    if (typeof decoded === 'string') throw new Error(decoded);
    const secp256k1 = await instantiateSecp256k1();
    const ripemd160 = await instantiateRipemd160();
    const pubkeyBytes = secp256k1.derivePublicKeyCompressed(decoded.privateKey);
    if (typeof pubkeyBytes === 'string') throw new Error(pubkeyBytes);
    const pkh = ripemd160.hash(sha256.hash(pubkeyBytes));
    const p2pkh = new Contract(getP2pkhBridgeArtifact() as any, [pkh], { provider });
    const signer = new SignatureTemplate(wif);
    const sponsorUnlocker = p2pkh.unlock.spend(pubkeyBytes, signer);

    txBuilder.addInput(
        {
            txid: sponsor.txid,
            vout: sponsor.vout,
            satoshis: BigInt(sponsor.value),
        },
        sponsorUnlocker,
        /** CashScript default 0xfffffffe can interact oddly with mixed CSV spends; max opts sponsor out of sequence semantics. */
        { sequence: 0xffffffff }
    );

    return { sponsorInputValue: BigInt(sponsor.value) };
}
