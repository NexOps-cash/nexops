/**
 * Canonical P2PKH bridge artifact used for burner funding and fee sponsorship.
 * Shared so sponsor logic stays separate from orchestration.
 */

import { compileString } from 'cashc';
import type { ContractArtifact } from '../../types';

const P2PKH_BRIDGE_SOURCE = `pragma cashscript ^0.13.0;

contract P2PKH(bytes20 pkh) {
    function spend(pubkey pk, sig s) {
        require(hash160(pk) == pkh);
        require(checkSig(s, pk));
    }
}`;

let cachedP2pkhBridgeArtifact: ContractArtifact | null = null;

export function getP2pkhBridgeArtifact(): ContractArtifact {
    if (!cachedP2pkhBridgeArtifact) {
        const raw = compileString(P2PKH_BRIDGE_SOURCE) as any;
        if (raw.errors?.length) {
            const msg = raw.errors.map((e: any) => (typeof e === 'string' ? e : e.message)).join('; ');
            throw new Error(`P2PKH bridge compile failed: ${msg}`);
        }
        if (!raw.bytecode) {
            throw new Error('P2PKH bridge compile failed: no bytecode');
        }
        cachedP2pkhBridgeArtifact = raw as ContractArtifact;
    }
    return cachedP2pkhBridgeArtifact;
}
