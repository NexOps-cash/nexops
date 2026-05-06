import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const covenantKind: ContractKind = {
  id: 'covenant',
  name: 'PolicyCovenant',
  summary: 'Secure policy covenant with strict two-output spend conservation and optional whitelist/tight-cap/emergency controls.',
  allowedRoles: ['quorum-spend', 'covenant-continuation'],
  fields: [
    { id: 'ownerPk', label: 'Owner pubkey', type: 'pubkey', description: 'Primary signing key.' },
    {
      id: 'maxSpend',
      label: 'Per-tx cap (sats)',
      type: 'int',
      description: 'Maximum value of tx.outputs[0] on any spend.',
      defaultValue: 250000,
    },
  ],
  features: [
    {
      id: 'recipientWhitelist',
      label: 'Recipient whitelist',
      group: 'Outputs',
      description: 'Enforces that spend output[0] matches a fixed locking bytecode destination.',
      fields: [
        {
          id: 'recipientLockingBytecode',
          label: 'Recipient lockingBytecode (hex)',
          type: 'bytes',
          description: 'Destination whitelist bytecode used when recipient whitelist is enabled.',
        },
        {
          id: 'recipientWhitelistEnabled',
          label: 'Recipient whitelist enabled',
          type: 'int',
          description: 'Set to 0 to disable whitelist, non-zero to enforce output[0] recipient locking bytecode.',
          defaultValue: 1,
        },
      ],
    },
    {
      id: 'tightCap',
      label: 'Tighter per-tx cap',
      group: 'Policy',
      description: 'Applies a secondary spend cap on top of the base maxSpend.',
      fields: [
        {
          id: 'tightCapSats',
          label: 'Tighter cap (sats)',
          type: 'int',
          description: 'Set to 0 to disable tighter cap, non-zero to apply second cap on spend output.',
          defaultValue: 0,
        },
      ],
    },
    {
      id: 'emergencyPath',
      label: 'Emergency freeze path',
      group: 'Auth',
      description: 'Adds emergency freeze function and related constructor fields.',
      fields: [
        {
          id: 'emergencyKey',
          label: 'Emergency key',
          type: 'pubkey',
          description: 'Emergency signer for freeze path.',
        },
        {
          id: 'emergencyEnabled',
          label: 'Emergency freeze enabled',
          type: 'int',
          description: 'Set to 0 to disable emergency freeze authorization, non-zero to enable.',
          defaultValue: 1,
        },
      ],
    },
  ],
  build: (opts): BuildOutput => {
    const whitelistEnabled = !!opts.enabled.recipientWhitelist;
    const tightCapEnabled = !!opts.enabled.tightCap;
    const emergencyEnabled = !!opts.enabled.emergencyPath;

    const spend: FunctionSpec = {
      name: 'spend',
      role: 'quorum-spend',
      params: ['sig ownerSig'],
      body: [
        'require(checkSig(ownerSig, ownerPk));',
        '',
        'require(tx.outputs.length == 2);',
        '',
        'int spendAmount = tx.outputs[0].value;',
        'int remaining = tx.outputs[1].value;',
        'int inputValue = tx.inputs[this.activeInputIndex].value;',
        '',
        'require(spendAmount + remaining == inputValue);',
        'require(spendAmount <= maxSpend);',
        ...(tightCapEnabled
          ? [
              '',
              'if (tightCapSats != 0) {',
              '    require(spendAmount <= tightCapSats);',
              '}',
            ]
          : []),
        ...(whitelistEnabled
          ? [
              '',
              'if (recipientWhitelistEnabled != 0) {',
              '    require(tx.outputs[0].lockingBytecode == recipientLockingBytecode);',
              '}',
            ]
          : []),
        '',
        'require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
      ],
    };

    const functions: FunctionSpec[] = [spend];

    if (emergencyEnabled) {
      functions.push({
        name: 'emergencyFreeze',
        role: 'covenant-continuation',
        params: ['sig emergencySig'],
        body: [
          'require(emergencyEnabled != 0);',
          '',
          'require(checkSig(emergencySig, emergencyKey));',
        ],
      });
    }

    return { functions };
  },
};
