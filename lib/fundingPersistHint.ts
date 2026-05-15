/** Browser hint: contract was funded at least once — survives reload when balance RPC lags or DB row lacks deployment_record */
const KEY_PREFIX = 'nexops_funded_contract:';

export function setFundingConfirmedHint(projectId: string, contractAddress: string): void {
    try {
        localStorage.setItem(`${KEY_PREFIX}${projectId}`, JSON.stringify({ contractAddress: contractAddress.trim() }));
    } catch {
        /* ignore quota / private mode */
    }
}

export function clearFundingConfirmedHint(projectId: string): void {
    try {
        localStorage.removeItem(`${KEY_PREFIX}${projectId}`);
    } catch {
        /* ignore */
    }
}

export function readFundingConfirmedHint(projectId: string, contractAddress: string): boolean {
    const addr = contractAddress.trim();
    if (!addr) return false;
    try {
        const raw = localStorage.getItem(`${KEY_PREFIX}${projectId}`);
        if (!raw) return false;
        const j = JSON.parse(raw) as { contractAddress?: string };
        return j.contractAddress === addr;
    } catch {
        return false;
    }
}
