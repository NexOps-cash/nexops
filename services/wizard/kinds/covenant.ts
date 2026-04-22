import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const covenantKind: ContractKind = {
  id: 'covenant',
  name: 'PolicyCovenant',
  summary: 'Owner-signed spend with per-tx value cap and optional output whitelist / freeze.',
  allowedRoles: ['owner-spend', 'bound-payout', 'covenant-continuation'],
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
      description: 'Force output 0 to be paid to a fixed locking bytecode (as raw bytes).',
      fields: [
        {
          id: 'recipientLockingBytecode',
          label: 'Recipient lockingBytecode (hex)',
          type: 'bytes',
          description: 'Raw locking bytecode bytes of the allowed recipient.',
        },
      ],
    },
    {
      id: 'tighterCap',
      label: 'Tighter spend cap',
      group: 'Policy',
      description: 'Adds an additional, tighter per-tx cap that applies on top of the base cap.',
      fields: [
        {
          id: 'tightCapSats',
          label: 'Tighter cap (sats)',
          type: 'int',
          description: 'Second value cap; typically smaller than maxSpend.',
          defaultValue: 100000,
        },
      ],
    },
    {
      id: 'emergencyKey',
      label: 'Emergency freeze',
      group: 'Policy',
      description: 'Adds an emergency branch that returns funds to the covenant bytecode (value-preserving).',
      fields: [{ id: 'emergencyKey', label: 'Emergency key', type: 'pubkey', description: 'Emergency signer.' }],
    },
  ],
  build: (opts): BuildOutput => {
    const useWhitelist = !!opts.enabled.recipientWhitelist;
    const spendBody: string[] = [
      'require(checkSig(ownerSig, ownerPk));',
      'require(tx.outputs[0].value <= maxSpend);',
    ];
    if (opts.enabled.tighterCap) {
      spendBody.push('require(tx.outputs[0].value <= tightCapSats);');
    }

    const spend: FunctionSpec = useWhitelist
      ? {
          name: 'spend',
          role: 'bound-payout',
          params: ['sig ownerSig'],
          body: spendBody,
          invariantParams: {
            boundRecipient: { lockingBytecodeParam: 'recipientLockingBytecode' },
          },
        }
      : {
          name: 'spend',
          role: 'owner-spend',
          params: ['sig ownerSig'],
          body: spendBody,
        };

    const functions: FunctionSpec[] = [spend];

    if (opts.enabled.emergencyKey) {
      functions.push({
        name: 'emergencyFreeze',
        role: 'covenant-continuation',
        params: ['sig emergencySig'],
        body: ['require(checkSig(emergencySig, emergencyKey));'],
      });
    }

    return { functions };
  },
};
