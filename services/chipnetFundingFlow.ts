import { checkFundingNow, pollForFunding, type FundingStatus } from './blockchainService';

/** Default Chipnet funding poll window (5 minutes). */
export const CHIPNET_FUNDING_POLL_TIMEOUT_MS = 300_000;

/** BIP-21 payment URI for Chipnet contract funding. */
export function buildChipnetPaymentUri(
  contractAddress: string,
  fundingAmountSats: number,
  label: string
): string {
  const amountBch = fundingAmountSats / 100_000_000;
  return `${contractAddress}?amount=${amountBch.toFixed(8)}&label=${encodeURIComponent(label)}`;
}

export interface ChipnetFundingPollOptions {
  address: string;
  fundingAmountSats: number;
  onStatus: (status: FundingStatus) => void;
  timeoutMs?: number;
  isCancelled?: () => boolean;
}

/** Shared Electrum polling wrapper used by workspace deploy and wizard deploy. */
export async function pollChipnetContractFunding(options: ChipnetFundingPollOptions): Promise<void> {
  const timeoutMs = options.timeoutMs ?? CHIPNET_FUNDING_POLL_TIMEOUT_MS;
  await pollForFunding(
    options.address,
    options.fundingAmountSats,
    (status) => {
      if (options.isCancelled?.()) return;
      options.onStatus(status);
    },
    timeoutMs
  );
}

export { checkFundingNow };
