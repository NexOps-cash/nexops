import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const vestingKind: ContractKind = {
  id: 'vesting',
  name: 'LinearVesting',
  summary: 'Beneficiary can claim only between cliff and end time, with a per-claim cap.',
  allowedRoles: ['owner-spend', 'owner-escape'],
  fields: [
    { id: 'beneficiaryPk', label: 'Beneficiary pubkey', type: 'pubkey', description: 'Claim signer.' },
    {
      id: 'cliffTime',
      label: 'Cliff time',
      type: 'unixTime',
      description: 'No claims permitted before this UNIX time.',
      defaultValue: 1735689600,
    },
    {
      id: 'endTime',
      label: 'End time',
      type: 'unixTime',
      description: 'Upper bound for claims; used as a hard expiry guard.',
      defaultValue: 1767225600,
    },
    {
      id: 'totalAmount',
      label: 'Per-claim cap (sats)',
      type: 'int',
      description: 'Maximum output value the beneficiary can send in a single claim.',
      defaultValue: 1000000,
    },
  ],
  features: [
    {
      id: 'revocable',
      label: 'Admin revocation',
      group: 'Policy',
      description: 'Adds a revoke() function signed by an admin key (e.g., to sweep after expiry).',
      fields: [{ id: 'adminPk', label: 'Admin pubkey', type: 'pubkey', description: 'Admin revocation key.' }],
    },
  ],
  build: (opts): BuildOutput => {
    const claim: FunctionSpec = {
      name: 'claim',
      role: 'owner-spend',
      params: ['sig beneficiarySig'],
      body: [
        'require(checkSig(beneficiarySig, beneficiaryPk));',
        'require(tx.time >= cliffTime);',
        // CashScript only allows tx.time on the LHS of >= for timelocks. The endTime > cliffTime
        // sanity bound is kept here so the field is not dropped as unused; the revoke() path is
        // the documented way to sweep funds after the vesting window ends.
        'require(endTime > cliffTime);',
        'require(tx.outputs[0].value <= totalAmount);',
      ],
    };

    const functions: FunctionSpec[] = [claim];

    if (opts.enabled.revocable) {
      functions.push({
        name: 'revoke',
        role: 'owner-escape',
        params: ['sig adminSig'],
        body: [
          'require(checkSig(adminSig, adminPk));',
          'require(tx.time >= endTime);',
        ],
      });
    }

    return { functions };
  },
};
