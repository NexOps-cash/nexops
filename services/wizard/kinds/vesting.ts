import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const vestingKind: ContractKind = {
  id: 'vesting',
  name: 'LinearVesting',
  summary: 'Time-based vesting covenant with optional revocation.',
  fields: [
    { id: 'beneficiaryPk', label: 'Beneficiary pubkey', type: 'pubkey', description: 'Claim signer.' },
    { id: 'cliffTime', label: 'Cliff time', type: 'unixTime', description: 'No claims before this time.', defaultValue: 1735689600 },
    { id: 'endTime', label: 'End time', type: 'unixTime', description: 'Fully vested at this time.', defaultValue: 1767225600 },
    { id: 'totalAmount', label: 'Total amount (sats)', type: 'int', description: 'Maximum allocated amount.', defaultValue: 1000000 },
  ],
  features: [
    {
      id: 'revocable',
      label: 'Admin revocation',
      group: 'Policy',
      description: 'Adds admin path for revoking unvested remainder.',
      fields: [{ id: 'adminPk', label: 'Admin pubkey', type: 'pubkey', description: 'Admin revocation key.' }],
    },
    {
      id: 'covenantContinuation',
      label: 'State continuation covenant',
      group: 'Outputs',
      description: 'Force same locking bytecode to preserve schedule state.',
      disabled: true,
      disabledReason: 'Coming soon',
    },
  ],
  build: (opts) => {
    const blocks = ['vestingLinear'];
    if (opts.enabled.covenantContinuation) blocks.push('covenantContinuation');
    const guards = collectBlockGuards(blocks);
    const functions = collectBlockFunctions(blocks);
    const source = [
      '    function claim(sig beneficiarySig) {',
      '        require(checkSig(beneficiarySig, beneficiaryPk));',
      '        require(tx.time >= cliffTime);',
      ...guards.map((g) => `        ${g}`),
      '    }',
      '',
      ...(opts.enabled.revocable
        ? [
            '    function revoke(sig adminSig) {',
            '        require(checkSig(adminSig, adminPk));',
            '    }',
            '',
          ]
        : []),
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
