import { BuildOutput, ContractKind, FunctionSpec } from '../schema';
import { makeDistinctPubkeyValidator } from '../crossFieldValidators';

export const escrowKind: ContractKind = {
  id: 'escrow',
  name: 'ArbitrationEscrow',
  summary: 'Single secure escrow template with arbiter routes, strict single-output payouts, and optional cap/oracle controls.',
  allowedRoles: ['quorum-spend'],
  fields: [
    { id: 'buyerPk', label: 'Buyer pubkey', type: 'pubkey', description: 'Buyer signing key.' },
    { id: 'sellerPk', label: 'Seller pubkey', type: 'pubkey', description: 'Seller signing key.' },
    { id: 'arbiterPk', label: 'Arbiter pubkey', type: 'pubkey', description: 'Dispute resolver key.' },
    {
      id: 'buyerLockingBytecode',
      label: 'Buyer lockingBytecode (hex)',
      type: 'bytes',
      description: 'Raw locking bytecode bytes for the buyer payout destination (used on arbitrateToBuyer / refund).',
    },
    {
      id: 'sellerLockingBytecode',
      label: 'Seller lockingBytecode (hex)',
      type: 'bytes',
      description: 'Raw locking bytecode bytes for the seller payout destination (used on arbitrateToSeller and partial release).',
    },
    {
      id: 'releaseCapSats',
      label: 'Release cap (sats)',
      type: 'int',
      description: 'Set to 0 for full value preservation; non-zero caps seller payout paths.',
      defaultValue: 0,
    },
  ],
  features: [
    {
      id: 'oraclePath',
      label: 'Oracle verification path',
      group: 'Auth',
      description: 'Adds oracle checkDataSig branch to arbitration functions and related constructor fields.',
      fields: [
        {
          id: 'oraclePk',
          label: 'Oracle pubkey',
          type: 'pubkey',
          description: 'Oracle key used when oracle checks are enabled.',
        },
        {
          id: 'oracleEnabled',
          label: 'Oracle enabled',
          type: 'int',
          description: 'Set to 0 to disable oracle checks, non-zero to require checkDataSig over tx-bound hash.',
          defaultValue: 1,
        },
      ],
    },
    {
      id: 'timeoutRefund',
      label: 'Timeout refund path',
      group: 'Timing',
      description: 'Adds a buyer-unilateral refund function gated on a relative block timeout.',
      fields: [
        {
          id: 'timeoutHeight',
          label: 'Timeout (blocks)',
          type: 'blockHeight',
          description: 'Relative timeout (nSequence) before buyer can unilaterally refund.',
          defaultValue: 1008,
        },
      ],
    },
    {
      id: 'strictDistinctKeys',
      label: 'On-chain distinct keys',
      group: 'Policy',
      description: 'Add buyer/seller/arbiter distinctness checks in every escrow path.',
    },
  ],
  crossFieldValidators: [makeDistinctPubkeyValidator(['buyerPk', 'sellerPk', 'arbiterPk'])],
  build: (opts): BuildOutput => {
    const strict = !!opts.enabled.strictDistinctKeys;
    const oracleEnabled = !!opts.enabled.oraclePath;
    const timeoutEnabled = !!opts.enabled.timeoutRefund;

    const distinctChecks = strict
      ? [
          'require(buyerPk != sellerPk);',
          'require(buyerPk != arbiterPk);',
          'require(sellerPk != arbiterPk);',
        ]
      : [];

    const oracleBlock = [
      'if (oracleEnabled != 0) {',
      '    bytes32 txHash = hash256(',
      '        tx.inputs[this.activeInputIndex].outpointTransactionHash',
      '        + bytes8(tx.outputs[0].value)',
      '        + tx.outputs[0].lockingBytecode',
      '    );',
      '    require(checkDataSig(oracleSig, txHash, oraclePk));',
      '}',
    ];

    const complete: FunctionSpec = {
      name: 'complete',
      role: 'quorum-spend',
      params: ['sig buyerSig', 'sig sellerSig'],
      body: [
        'require(checkSig(buyerSig, buyerPk));',
        'require(checkSig(sellerSig, sellerPk));',
        ...distinctChecks,
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].lockingBytecode == sellerLockingBytecode);',
        '',
        'if (releaseCapSats == 0) {',
        '    require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
        '} else {',
        '    require(tx.outputs[0].value <= releaseCapSats);',
        '}',
      ],
    };

    const arbitrateToBuyer: FunctionSpec = {
      name: 'arbitrateToBuyer',
      role: 'quorum-spend',
      params: oracleEnabled
        ? ['sig arbiterSig', 'sig buyerSig', 'datasig oracleSig']
        : ['sig arbiterSig', 'sig buyerSig'],
      body: [
        'require(checkSig(arbiterSig, arbiterPk));',
        'require(checkSig(buyerSig, buyerPk));',
        ...distinctChecks,
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
        ...(oracleEnabled ? ['', ...oracleBlock, ''] : ['']),
        'require(tx.outputs[0].lockingBytecode == buyerLockingBytecode);',
      ],
    };

    const arbitrateToSeller: FunctionSpec = {
      name: 'arbitrateToSeller',
      role: 'quorum-spend',
      params: oracleEnabled
        ? ['sig arbiterSig', 'sig sellerSig', 'datasig oracleSig']
        : ['sig arbiterSig', 'sig sellerSig'],
      body: [
        'require(checkSig(arbiterSig, arbiterPk));',
        'require(checkSig(sellerSig, sellerPk));',
        ...distinctChecks,
        '',
        'require(tx.outputs.length == 1);',
        'if (releaseCapSats == 0) {',
        '    require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
        '} else {',
        '    require(tx.outputs[0].value <= releaseCapSats);',
        '}',
        ...(oracleEnabled ? ['', ...oracleBlock, ''] : ['']),
        'require(tx.outputs[0].lockingBytecode == sellerLockingBytecode);',
      ],
    };

    const functions: FunctionSpec[] = [complete, arbitrateToBuyer, arbitrateToSeller];

    if (timeoutEnabled) {
      functions.push({
        name: 'timeoutRefund',
        role: 'quorum-spend',
        params: ['sig buyerSig'],
        body: [
          'require(checkSig(buyerSig, buyerPk));',
          ...distinctChecks,
          'require(this.age >= timeoutHeight);',
          '',
          'require(tx.outputs.length == 1);',
          'require(tx.outputs[0].lockingBytecode == buyerLockingBytecode);',
          'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
        ],
      });
    }

    return { functions };
  },
};
