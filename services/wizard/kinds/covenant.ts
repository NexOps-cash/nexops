import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const covenantKind: ContractKind = {
  id: 'covenant',
  name: 'PolicyCovenant',
  summary: 'Owner spend with output policy controls.',
  fields: [
    { id: 'ownerPk', label: 'Owner pubkey', type: 'pubkey', description: 'Primary signing key.' },
    { id: 'maxSpend', label: 'Max spend (sats)', type: 'int', description: 'Per-transaction spend cap.', defaultValue: 250000 },
  ],
  features: [
    {
      id: 'recipientWhitelist',
      label: 'Recipient whitelist',
      group: 'Outputs',
      description: 'Lock first output to a whitelisted locking bytecode.',
      fields: [{ id: 'recipientLockingBytecode', label: 'Recipient locking bytecode', type: 'bytes32', description: 'Output script hash/identifier.' }],
    },
    {
      id: 'dailyCap',
      label: 'Daily cap guard',
      group: 'Policy',
      description: 'Adds simple daily cap style guard (value cap placeholder).',
      fields: [{ id: 'dailyCapSats', label: 'Daily cap (sats)', type: 'int', description: 'Daily budget cap.', defaultValue: 500000 }],
    },
    {
      id: 'emergencyKey',
      label: 'Emergency freeze',
      group: 'Policy',
      description: 'Emergency freeze function signed by separate key.',
      fields: [{ id: 'emergencyKey', label: 'Emergency key', type: 'pubkey', description: 'Freeze signer key.' }],
    },
  ],
  build: (opts) => {
    const blocks = ['amountCap'];
    if (opts.enabled.recipientWhitelist) blocks.push('recipientWhitelist');
    if (opts.enabled.dailyCap) blocks.push('dailyCap');
    if (opts.enabled.emergencyKey) blocks.push('emergencyKey');
    const guards = collectBlockGuards(blocks);
    const functions = collectBlockFunctions(blocks);
    const source = [
      '    function spend(sig ownerSig) {',
      '        require(checkSig(ownerSig, ownerPk));',
      ...guards.map((g) => `        ${g}`),
      '    }',
      '',
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
