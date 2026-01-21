/**
 * Blockchain Service - UTXO Monitoring for BCH Chipnet
 * Uses FullStack.cash API (free, no key required)
 */

export interface UTXO {
    txid: string;
    vout: number;
    value: number; // in satoshis
    height: number;
    confirmations: number;
}

export interface FundingStatus {
    status: 'idle' | 'monitoring' | 'confirmed' | 'timeout' | 'error';
    utxos: UTXO[];
    totalValue: number;
    txid?: string;
    error?: string;
}

const FULLSTACK_API = 'https://api.fullstack.cash/v5';
const CHIPNET_EXPLORER = 'https://chipnet.chaingraph.cash/tx';

/**
 * Get UTXOs for a given address on Chipnet
 */
export async function getUTXOs(address: string): Promise<UTXO[]> {
    try {
        // FullStack.cash endpoint for address UTXOs
        const response = await fetch(`${FULLSTACK_API}/electrumx/utxos/${address}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // FullStack.cash returns { success: true, utxos: [...] }
        if (data.success && Array.isArray(data.utxos)) {
            return data.utxos.map((utxo: any) => ({
                txid: utxo.tx_hash,
                vout: utxo.tx_pos,
                value: utxo.value,
                height: utxo.height,
                confirmations: utxo.confirmations || 0,
            }));
        }

        return [];
    } catch (error) {
        console.error('[blockchainService] getUTXOs error:', error);
        throw error;
    }
}

/**
 * Poll for funding at an address
 * Resolves when UTXOs totaling >= expectedAmount are found
 * Rejects on timeout or error
 */
export async function pollForFunding(
    address: string,
    expectedAmount: number,
    onUpdate: (status: FundingStatus) => void,
    timeoutMs: number = 300000 // 5 minutes default
): Promise<FundingStatus> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                // Check timeout
                if (Date.now() - startTime > timeoutMs) {
                    const timeoutStatus: FundingStatus = {
                        status: 'timeout',
                        utxos: [],
                        totalValue: 0,
                        error: 'Funding timeout - please verify manually',
                    };
                    onUpdate(timeoutStatus);
                    reject(timeoutStatus);
                    return;
                }

                // Query UTXOs
                const utxos = await getUTXOs(address);
                const totalValue = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

                console.log(`[blockchainService] Poll: ${utxos.length} UTXOs, ${totalValue} sats`);

                // Update status
                const status: FundingStatus = {
                    status: totalValue >= expectedAmount ? 'confirmed' : 'monitoring',
                    utxos,
                    totalValue,
                    txid: utxos.length > 0 ? utxos[0].txid : undefined,
                };

                onUpdate(status);

                // Check if funded
                if (totalValue >= expectedAmount) {
                    resolve(status);
                    return;
                }

                // Continue polling
                setTimeout(poll, pollInterval);
            } catch (error) {
                console.error('[blockchainService] Poll error:', error);
                const errorStatus: FundingStatus = {
                    status: 'error',
                    utxos: [],
                    totalValue: 0,
                    error: (error as Error).message,
                };
                onUpdate(errorStatus);

                // Retry on network errors
                setTimeout(poll, pollInterval * 2); // Exponential backoff
            }
        };

        // Start polling
        poll();
    });
}

/**
 * Get explorer link for a transaction
 */
export function getExplorerLink(txid: string): string {
    return `${CHIPNET_EXPLORER}/${txid}`;
}
