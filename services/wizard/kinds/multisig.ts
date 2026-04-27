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
  ],
  features: [
    {
      id: 'oraclePath',
      label: 'Oracle verification path',
      group: 'Auth',
      description: 'Adds oracle check branch and related constructor fields.',
      fields: [
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
          defaultValue: 1,
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
          description: 'Emergency freeze signer key.',
        },
        {
          id: 'emergencyEnabled',
          label: 'Emergency freeze enabled',
          type: 'int',
          description: 'Set to 0 to disable emergency freeze authorization, or non-zero to enable it.',
          defaultValue: 1,
        },
      ],
    },
    {
      id: 'strictDistinctKeys',
      label: 'On-chain distinct keys',
      group: 'Policy',
      description: 'Enforce pk1 != pk2 != pk3 inside spend().',
    },
  ],
  crossFieldValidators: [makeDistinctPubkeyValidator(['pk1', 'pk2', 'pk3'])],
  build: (opts): BuildOutput => {
    const oracleEnabled = opts.enabled.oraclePath === true;
    const emergencyEnabled = opts.enabled.emergencyPath === true;

    const spend: FunctionSpec = {
      name: 'spend',
      role: 'quorum-spend',
      params: oracleEnabled ? ['sig s1', 'sig s2', 'datasig oracleSig'] : ['sig s1', 'sig s2'],
      body: [
        'if (unlockTime != 0) {',
        '    require(tx.time >= unlockTime);',
        '}',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
        ...(oracleEnabled
          ? [
              '',
              'if (oracleEnabled != 0) {',
              '    bytes32 txHash = hash256(',
              '        tx.inputs[this.activeInputIndex].outpointTransactionHash',
              '        + bytes8(tx.outputs[0].value)',
              '        + tx.outputs[0].lockingBytecode',
              '    );',
              '    require(checkDataSig(oracleSig, txHash, oraclePk));',
              '}',
              '',
            ]
          : []),
        'require(checkMultiSig([s1, s2], [pk1, pk2, pk3]));',
      ],
      extraInvariants: opts.enabled.strictDistinctKeys ? ['DISTINCT_PUBKEYS'] : [],
      invariantParams: opts.enabled.strictDistinctKeys
        ? { distinctPubkeys: ['pk1', 'pk2', 'pk3'] }
        : undefined,
    };
    const functions: FunctionSpec[] = [spend];
    if (emergencyEnabled) {
      functions.push({
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
      });
    }
    return { functions };
  },
};
