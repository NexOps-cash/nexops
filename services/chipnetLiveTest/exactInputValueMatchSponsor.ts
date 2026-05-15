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
import { estimateChipnetRelayFootprintFeeSats, type OutputStrategy } from '../wizard/txPlanning';
import { fetchUTXOsWithTimeout, type UTXO } from '../blockchainService';
import { getP2pkhBridgeArtifact } from './p2pkhBridgeArtifact';

const CHANGE_DUST_SATS = 546n;
/** Extra slack beyond footprint relay estimate (rounding / wallet-specific overhead). */
const SPONSOR_RELAY_MARGIN_SATS = 3500n;

function utxoSetFingerprint(us: UTXO[]): string {
    return [...us]
        .sort((a, b) => a.txid.localeCompare(b.txid) || a.vout - b.vout)
        .map((u) => `${u.txid}:${u.vout}:${u.height}:${u.value}`)
        .join('|');
}

/** Two identical Electrum snapshots back-to-back avoids picking coins a funding tx just spent (stale list → mempool conflict). */
async function fetchStableBurnerUtxos(burnerAddress: string): Promise<UTXO[]> {
    let prev = await fetchUTXOsWithTimeout(burnerAddress);
    for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 280));
        const cur = await fetchUTXOsWithTimeout(burnerAddress);
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
    /**
     * Size-aware minimum sponsor coin value. Covenant + sponsor + change output often needs many ksats on Chipnet;
     * picking ≥600 sats caused relay error 66.
     */
    sponsorSizing?: { covenantInputCount: number; covenantOutputCount: number };
}): Promise<{ sponsorInputValue: bigint }> {
    const { outputStrategy, txBuilder, provider, wif, burnerAddress, forceSponsor, sponsorSizing } = params;

    if (outputStrategy.kind !== 'exact-input-value-to-wallet' && !forceSponsor) {
        return { sponsorInputValue: 0n };
    }

    let minSponsorValue = 18_000n;
    if (sponsorSizing) {
        const footprintRelay = estimateChipnetRelayFootprintFeeSats(
            sponsorSizing.covenantInputCount + 1,
            sponsorSizing.covenantOutputCount + 1
        );
        minSponsorValue = footprintRelay + CHANGE_DUST_SATS + SPONSOR_RELAY_MARGIN_SATS;
    }

    const burnerSpendUtxos: UTXO[] = await fetchStableBurnerUtxos(burnerAddress);
    const bigEnough = burnerSpendUtxos.filter((u) => BigInt(u.value) >= minSponsorValue);
    /** Prefer mined sponsor outs so we do not race Electrum 0-conf lists after a funding tx spent overlapping coins */
    const confirmedPool = bigEnough.filter((u) => u.height > 0).sort((a, b) => a.value - b.value);
    const pool = confirmedPool.length > 0 ? confirmedPool : bigEnough.sort((a, b) => a.value - b.value);
    const sponsor = pool[0];
    if (!sponsor) {
        throw new Error(
            `No single burner UTXO ≥ ${minSponsorValue} sats to sponsor Chipnet relay fees for this covenant spend ` +
                `(your identities may show aggregate balance, but each coin must be large enough — consolidate or fund one ≥ ${minSponsorValue}).`
        );
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
