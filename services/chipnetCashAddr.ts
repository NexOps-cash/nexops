import { decodeCashAddress, encodeCashAddress } from '@bitauth/libauth';

/**
 * CashScript sometimes returns `bitcoincash:` token addresses even when connected to Chipnet.
 * Electrum Chipnet indexes UTXOs by locking bytecode; re-encoding with `bchtest:` preserves
 * payload + type so the script hash matches what Chipnet wallets actually pay.
 */
export function normalizeChipnetCashAddress(address: string): string {
  const decoded = decodeCashAddress(address.trim());
  if (typeof decoded === 'string') {
    throw new Error(decoded);
  }
  const encoded = encodeCashAddress({
    prefix: 'bchtest',
    type: decoded.type,
    payload: decoded.payload,
  });
  return encoded.address;
}
