import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const multisigKind: ContractKind = {
  id: 'multisig',
  name: 'MultisigVault',
  summary: 'Threshold-controlled vault with optional policy safeguards.',
  fields: [
    { id: 'threshold', label: 'Threshold', type: 'int', description: 'Required signatures.', defaultValue: 2 },
    { id: 'pk1', label: 'Signer 1', type: 'pubkey', description: 'Compressed pubkey for signer 1.' },
    { id: 'pk2', label: 'Signer 2', type: 'pubkey', description: 'Compressed pubkey for signer 2.' },
    { id: 'pk3', label: 'Signer 3', type: 'pubkey', description: 'Compressed pubkey for signer 3.' },
  ],
  features: [
    {
      id: 'timelockAbsolute',
      label: 'Absolute timelock',
      group: 'Timing',
      description: 'Require tx.time to be after a fixed UNIX timestamp.',
      fields: [{ id: 'unlockTime', label: 'Unlock time', type: 'unixTime', description: 'Unix timestamp.', defaultValue: 1735689600 }],
    },
    {
      id: 'emergencyKey',
      label: 'Emergency freeze',
      group: 'Policy',
      description: 'Adds emergency freeze branch controlled by one key.',
      fields: [{ id: 'emergencyKey', label: 'Emergency key', type: 'pubkey', description: 'Key for emergency function.' }],
    },
    {
      id: 'oracleDataSig',
      label: 'Oracle override',
      group: 'Policy',
      description: 'Require data signature from an oracle key before spend.',
      fields: [{ id: 'oraclePk', label: 'Oracle pubkey', type: 'pubkey', description: 'Trusted oracle public key.' }],
    },
  ],
  build: (opts) => {
    const enabledBlocks = ['multisigN'];
    if (opts.enabled.timelockAbsolute) enabledBlocks.push('timelockAbsolute');
    if (opts.enabled.oracleDataSig) enabledBlocks.push('oracleDataSig');
    if (opts.enabled.emergencyKey) enabledBlocks.push('emergencyKey');

    const guards = collectBlockGuards(enabledBlocks);
    const functions = collectBlockFunctions(enabledBlocks);
    const source = [
      '    function spend(sig s1, sig s2, sig s3, datasig oracleSig, bytes oracleMessage) {',
      '        sig[] signatures = [s1, s2, s3];',
      '        pubkey[] authorizedPubkeys = [pk1, pk2, pk3];',
      '        require(threshold >= 1);',
      ...guards.map((g) => `        ${g}`),
      '    }',
      '',
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
