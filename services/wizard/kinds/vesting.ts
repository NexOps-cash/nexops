import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const vestingKind: ContractKind = {
  id: 'vesting',
  name: 'LinearVesting',
  summary: 'Stateful linear vesting with 2-output continuation claims and optional admin revocation.',
  allowedRoles: ['quorum-spend'],
  fields: [
    { id: 'beneficiaryPk', label: 'Beneficiary pubkey', type: 'pubkey', description: 'Claim signer.' },
    {
      id: 'startTime',
      label: 'Start time',
      type: 'unixTime',
      description: 'Vesting schedule start UNIX time.',
      defaultValue: 1735603200,
    },
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
      label: 'Total vesting amount (sats)',
      type: 'int',
      description: 'Total amount that linearly unlocks across the schedule.',
      defaultValue: 1000000,
    },
    {
      id: 'adminPk',
      label: 'Admin pubkey',
      type: 'pubkey',
      description: 'Admin key used for revoke path when admin revocation is enabled.',
    },
    {
      id: 'adminEnabled',
      label: 'Admin revocation enabled',
      type: 'int',
      description: 'Set to 0 to disable revoke authorization, non-zero to enable admin revocation.',
      defaultValue: 0,
    },
  ],
  features: [],
  build: (opts): BuildOutput => {
    const claim: FunctionSpec = {
      name: 'claim',
      role: 'quorum-spend',
      params: ['sig beneficiarySig'],
      body: [
        'require(checkSig(beneficiarySig, beneficiaryPk));',
        '',
        'require(endTime > cliffTime);',
        'require(cliffTime >= startTime);',
        '',
        'require(tx.time >= cliffTime);',
        '',
        'require(tx.outputs.length == 2);',
        '',
        'int duration = endTime - startTime;',
        'int remaining = tx.outputs[1].value;',
        'int inputValue = tx.inputs[this.activeInputIndex].value;',
        'int payout = inputValue - remaining;',
        '',
        'require(duration > 0);',
        'require(payout <= totalAmount);',
        '',
        'require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
      ],
    };

    const revoke: FunctionSpec = {
      name: 'revoke',
      role: 'quorum-spend',
      params: ['sig adminSig'],
      body: [
        'require(adminEnabled != 0);',
        'require(checkSig(adminSig, adminPk));',
        '',
        'require(tx.time >= endTime);',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
      ],
    };

    return { functions: [claim, revoke] };
  },
};
