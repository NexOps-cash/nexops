import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const covenantKind: ContractKind = {
  id: 'covenant',
  name: 'PolicyCovenant',
  summary: 'Secure policy covenant with strict two-output spend conservation and optional whitelist/tight-cap/emergency controls.',
  allowedRoles: ['quorum-spend'],
  fields: [
    { id: 'ownerPk', label: 'Owner pubkey', type: 'pubkey', description: 'Primary signing key.' },
    {
      id: 'maxSpend',
      label: 'Per-tx cap (sats)',
      type: 'int',
      description: 'Maximum value of tx.outputs[0] on any spend.',
      defaultValue: 250000,
    },
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
      defaultValue: 0,
    },
    {
      id: 'tightCapSats',
      label: 'Tighter cap (sats)',
      type: 'int',
      description: 'Set to 0 to disable tighter cap, non-zero to apply second cap on spend output.',
      defaultValue: 0,
    },
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
      defaultValue: 0,
    },
  ],
  features: [],
  build: (opts): BuildOutput => {
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
        '',
        'if (tightCapSats != 0) {',
        '    require(spendAmount <= tightCapSats);',
        '}',
        '',
        'if (recipientWhitelistEnabled != 0) {',
        '    require(tx.outputs[0].lockingBytecode == recipientLockingBytecode);',
        '}',
        '',
        'require(tx.outputs[1].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
      ],
    };

    const emergencyFreeze: FunctionSpec = {
      name: 'emergencyFreeze',
      role: 'quorum-spend',
      params: ['sig emergencySig'],
      body: [
        'require(emergencyEnabled != 0);',
        'require(checkSig(emergencySig, emergencyKey));',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
      ],
    };

    return { functions: [spend, emergencyFreeze] };
  },
};
