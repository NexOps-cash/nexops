import { ContractKind } from '../schema';

/** Clamp threshold into the valid range for the fixed 3-pubkey vault. */
function pickThreshold(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(3, Math.trunc(n)));
}

export const multisigKind: ContractKind = {
  id: 'multisig',
  name: 'MultisigVault',
  summary: 'Threshold-controlled 3-signer vault with optional timelock, oracle, or emergency freeze.',
  fields: [
    {
      id: 'threshold',
      label: 'Threshold',
      type: 'int',
      description: 'Required signatures (1..3). Build-time only: shapes the spend function signature.',
      defaultValue: 2,
      buildOnly: true,
    },
    { id: 'pk1', label: 'Signer 1', type: 'pubkey', description: 'Compressed pubkey for signer 1.' },
    { id: 'pk2', label: 'Signer 2', type: 'pubkey', description: 'Compressed pubkey for signer 2.' },
    { id: 'pk3', label: 'Signer 3', type: 'pubkey', description: 'Compressed pubkey for signer 3.' },
  ],
  features: [
    {
      id: 'timelockAbsolute',
      label: 'Absolute timelock',
      group: 'Timing',
      description: 'Require tx.time to be at or past a fixed UNIX timestamp / block height.',
      fields: [
        {
          id: 'unlockTime',
          label: 'Unlock time',
          type: 'unixTime',
          description: 'Unix timestamp (>=500000000) or block height (<500000000).',
          defaultValue: 1735689600,
        },
      ],
    },
    {
      id: 'oracleDataSig',
      label: 'Oracle co-sign',
      group: 'Policy',
      description: 'Require an attested message from a trusted oracle pubkey before spend.',
      fields: [{ id: 'oraclePk', label: 'Oracle pubkey', type: 'pubkey', description: 'Trusted oracle public key.' }],
    },
    {
      id: 'emergencyKey',
      label: 'Emergency freeze',
      group: 'Policy',
      description: 'Adds an emergency branch: any single holder of emergencyKey can freeze funds back to the vault.',
      fields: [{ id: 'emergencyKey', label: 'Emergency key', type: 'pubkey', description: 'Emergency signer pubkey.' }],
    },
  ],
  build: (opts) => {
    const threshold = pickThreshold(opts.fields.threshold);
    const sigParams = Array.from({ length: threshold }, (_, i) => `sig s${i + 1}`);
    const sigArrayElements = Array.from({ length: threshold }, (_, i) => `s${i + 1}`);

    const spendArgs: string[] = [...sigParams];
    const spendBody: string[] = [];

    if (opts.enabled.timelockAbsolute) {
      spendBody.push('require(tx.time >= unlockTime);');
    }
    if (opts.enabled.oracleDataSig) {
      spendArgs.push('datasig oracleSig', 'bytes oracleMessage');
      spendBody.push('require(checkDataSig(oracleSig, oracleMessage, oraclePk));');
    }
    spendBody.push(
      `require(checkMultiSig([${sigArrayElements.join(', ')}], [pk1, pk2, pk3]));`,
    );

    const lines: string[] = [];
    lines.push(`    function spend(${spendArgs.join(', ')}) {`);
    for (const s of spendBody) lines.push(`        ${s}`);
    lines.push('    }');

    if (opts.enabled.emergencyKey) {
      lines.push('');
      lines.push('    function emergencyFreeze(sig emergencySig) {');
      lines.push('        require(checkSig(emergencySig, emergencyKey));');
      // Covenant: freeze = same locking bytecode must be preserved on output 0.
      lines.push(
        '        require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
      );
      lines.push('    }');
    }

    return { source: lines.join('\n'), hash: '', warnings: [] };
  },
};
