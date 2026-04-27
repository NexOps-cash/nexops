import { BuildOutput, ContractKind, FunctionSpec } from '../schema';
import { makeDistinctPubkeyValidator } from '../crossFieldValidators';

export const multisigKind: ContractKind = {
  id: 'multisig',
  name: 'MultisigVault',
  summary: 'Secure 2-of-3 vault with parameterized timelock, oracle check, and emergency freeze path.',
  allowedRoles: ['quorum-spend'],
  fields: [
    { id: 'pk1', label: 'Signer 1', type: 'pubkey', description: 'Compressed pubkey for signer 1.' },
    { id: 'pk2', label: 'Signer 2', type: 'pubkey', description: 'Compressed pubkey for signer 2.' },
    { id: 'pk3', label: 'Signer 3', type: 'pubkey', description: 'Compressed pubkey for signer 3.' },
    {
      id: 'unlockTime',
      label: 'Unlock time',
      type: 'int',
      description: 'Set to 0 to disable timelock; otherwise require tx.time >= unlockTime.',
      defaultValue: 0,
    },
    {
      id: 'oraclePk',
      label: 'Oracle pubkey',
      type: 'pubkey',
      description: 'Trusted oracle key used when oracle mode is enabled.',
    },
    {
      id: 'oracleEnabled',
      label: 'Oracle enabled',
      type: 'int',
      description: 'Set to 0 to disable oracle check, or non-zero to require checkDataSig over tx-bound hash.',
      defaultValue: 0,
    },
    {
      id: 'emergencyKey',
      label: 'Emergency key',
      type: 'pubkey',
      description: 'Emergency freeze signer key.',
    },
    {
      id: 'emergencyEnabled',
      label: 'Emergency freeze enabled',
      type: 'int',
      description: 'Set to 0 to disable emergency freeze authorization, or non-zero to enable it.',
      defaultValue: 0,
    },
  ],
  features: [
    {
      id: 'strictDistinctKeys',
      label: 'On-chain distinct keys',
      group: 'Policy',
      description: 'Enforce pk1 != pk2 != pk3 inside spend().',
    },
  ],
  crossFieldValidators: [makeDistinctPubkeyValidator(['pk1', 'pk2', 'pk3'])],
  build: (opts): BuildOutput => {
    const spend: FunctionSpec = {
      name: 'spend',
      role: 'quorum-spend',
      params: ['sig s1', 'sig s2', 'datasig oracleSig'],
      body: [
        'if (unlockTime != 0) {',
        '    require(tx.time >= unlockTime);',
        '}',
        '',
        'if (oracleEnabled != 0) {',
        '    bytes32 txHash = tx.inputs[this.activeInputIndex].outpointTransactionHash;',
        '    require(checkDataSig(oracleSig, txHash, oraclePk));',
        '}',
        '',
        'require(checkMultiSig([s1, s2], [pk1, pk2, pk3]));',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
      ],
      extraInvariants: opts.enabled.strictDistinctKeys ? ['DISTINCT_PUBKEYS'] : [],
      invariantParams: opts.enabled.strictDistinctKeys
        ? { distinctPubkeys: ['pk1', 'pk2', 'pk3'] }
        : undefined,
    };
    const emergencyFreeze: FunctionSpec = {
      name: 'emergencyFreeze',
      role: 'quorum-spend',
      params: ['sig emergencySig'],
      body: [
        'require(emergencyEnabled != 0);',
        '',
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
