export interface WizardBlock {
  params?: string[];
  functions?: string[];
  guards?: string[];
  requires?: string[];
}

export const WIZARD_BLOCKS: Record<string, WizardBlock> = {
  multisigN: {
    guards: ['require(checkMultiSig(signatures, authorizedPubkeys));'],
  },
  timelockRelative: {
    params: ['int minAge'],
    guards: ['require(tx.age >= minAge);'],
  },
  timelockAbsolute: {
    params: ['int unlockTime'],
    guards: ['require(tx.time >= unlockTime);'],
  },
  emergencyKey: {
    params: ['pubkey emergencyKey'],
    functions: [
      [
        '    function emergencyFreeze(sig emergencySig) {',
        '        require(checkSig(emergencySig, emergencyKey));',
        '    }',
      ].join('\n'),
    ],
  },
  amountCap: {
    params: ['int maxSpendSats'],
    guards: ['require(tx.outputs[0].value <= maxSpendSats);'],
  },
  recipientWhitelist: {
    params: ['bytes recipientLockingBytecode'],
    guards: ['require(tx.outputs[0].lockingBytecode == recipientLockingBytecode);'],
  },
  covenantContinuation: {
    guards: [
      'int idx = this.activeInputIndex;',
      'require(tx.outputs[idx].lockingBytecode == tx.inputs[idx].lockingBytecode);',
    ],
  },
  htlcHash160: {
    params: ['bytes20 digest160'],
    guards: ['require(hash160(secretPreimage) == digest160);'],
  },
  htlcSha256: {
    params: ['bytes32 digest256'],
    guards: ['require(sha256(secretPreimage) == digest256);'],
  },
  oracleDataSig: {
    params: ['pubkey oraclePk'],
    guards: ['require(checkDataSig(oracleSig, oracleMessage, oraclePk));'],
  },
  mintingNft: {
    guards: [
      '// NOTE: cashscript token introspection details depend on target compiler version.',
      '// This placeholder branch models intent and keeps source deterministic.',
      'require(true);',
    ],
  },
  vestingLinear: {
    params: ['int startTime', 'int endTime', 'int totalSats'],
    guards: [
      'require(tx.time >= startTime);',
      'require(endTime > startTime);',
      '// Placeholder guard for linear schedule bound checks.',
      'require(tx.outputs[0].value <= totalSats);',
    ],
  },
  partialRelease: {
    params: ['int releaseCapSats'],
    guards: ['require(tx.outputs[0].value <= releaseCapSats);'],
  },
  dailyCap: {
    params: ['int dailyCapSats'],
    guards: ['require(tx.outputs[0].value <= dailyCapSats);'],
  },
  burnToClaim: {
    guards: [
      '// Placeholder: enforce burn path with covenant/token introspection.',
      'require(true);',
    ],
  },
};

export function dedupeParams(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function collectBlockParams(ids: string[]): string[] {
  const all: string[] = [];
  for (const id of ids) all.push(...(WIZARD_BLOCKS[id]?.params ?? []));
  return dedupeParams(all);
}

export function collectBlockGuards(ids: string[]): string[] {
  return ids.flatMap((id) => WIZARD_BLOCKS[id]?.guards ?? []);
}

export function collectBlockFunctions(ids: string[]): string[] {
  return ids.flatMap((id) => WIZARD_BLOCKS[id]?.functions ?? []);
}
