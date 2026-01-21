/**
 * Blockchain Service - UTXO Monitoring for BCH Chipnet
 * Uses Chaingraph GraphQL API (more reliable than FullStack.cash)
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

const CHAINGRAPH_API = 'https://gql.chaingraph.pat.mn/v1/graphql';
const CHIPNET_EXPLORER = 'https://chipnet.chaingraph.cash/tx';

/**
 * Get UTXOs for a given address on Chipnet using Chaingraph GraphQL
 */
export async function getUTXOs(address: string): Promise<UTXO[]> {
    try {
        // Remove cashaddr prefix if present
        const cleanAddress = address.replace(/^(bchtest|bitcoincash):/, '');

        // Chaingraph GraphQL query for unspent outputs
        // We search by the encoded locking bytecode prefix (the address hash)
        const query = `
            query GetUTXOs {
                search_output(
                    args: { encoded_locking_bytecode_prefix_hex: "${cleanAddress}" }
                    where: { _not: { spent_by: {} } }
                    limit: 50
                ) {
                    transaction_hash
                    output_index
                    value_satoshis
                    block_inclusions(limit: 1, order_by: { block: { height: desc } }) {
                        block {
                            height
                        }
                    }
                }
            }
        `;

        const response = await fetch(CHAINGRAPH_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            throw new Error(`GraphQL Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (data.errors) {
            console.error('[blockchainService] GraphQL errors:', data.errors);
            return []; // Return empty array instead of throwing to allow retry
        }

        const outputs = data.data?.search_output || [];

        return outputs.map((output: any) => ({
            txid: output.transaction_hash,
            vout: output.output_index,
            value: output.value_satoshis,
            height: output.block_inclusions?.[0]?.block?.height || 0,
            confirmations: output.block_inclusions?.[0]?.block?.height ? 1 : 0,
        }));
    } catch (error) {
        console.error('[blockchainService] getUTXOs error:', error);
        return []; // Return empty array on error to allow retry
    }
}

/**
 * Poll for funding at an address
 * Resolves when ANY UTXOs are found (users may overfund or send multiple UTXOs)
 * Rejects on timeout or error
 */
export async function pollForFunding(
    address: string,
    minimumRequired: number,
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
                    // ✅ Check for ANY UTXO with sufficient total value
                    status: utxos.length > 0 && totalValue >= minimumRequired ? 'confirmed' : 'monitoring',
                    utxos,
                    totalValue,
                    txid: utxos.length > 0 ? utxos[0].txid : undefined,
                };

                onUpdate(status);

                // Check if funded
                if (utxos.length > 0 && totalValue >= minimumRequired) {
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
