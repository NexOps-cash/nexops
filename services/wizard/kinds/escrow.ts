import { BuildOutput, ContractKind, FunctionSpec } from '../schema';
import { makeDistinctPubkeyValidator } from '../crossFieldValidators';

export const escrowKind: ContractKind = {
  id: 'escrow',
  name: 'ArbitrationEscrow',
  summary: 'Two-party escrow with arbiter fallback, relative-time refund, and bytecode-anchored payouts.',
  allowedRoles: ['quorum-spend', 'bound-payout', 'owner-escape'],
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
      id: 'timeoutHeight',
      label: 'Timeout (blocks)',
      type: 'blockHeight',
      description: 'Relative timeout (nSequence) before buyer can unilaterally refund.',
      defaultValue: 1008,
    },
  ],
  features: [
    {
      id: 'partialRelease',
      label: 'Release cap',
      group: 'Outputs',
      description: 'Cap the seller payout for staged / partial releases. When enabled, complete() binds output 0 to the seller.',
      fields: [
        {
          id: 'releaseCapSats',
          label: 'Release cap (sats)',
          type: 'int',
          description: 'Maximum value of tx.outputs[0] for cooperative completion.',
          defaultValue: 100000,
        },
      ],
    },
    {
      id: 'oracleDataSig',
      label: 'Oracle attestation',
      group: 'Policy',
      description: 'Require a signed oracle message for arbiter-assisted resolution branches.',
      fields: [{ id: 'oraclePk', label: 'Oracle pubkey', type: 'pubkey', description: 'Oracle signing key.' }],
    },
    {
      id: 'strictDistinctKeys',
      label: 'On-chain distinct keys',
      group: 'Policy',
      description: 'Enforce buyerPk != sellerPk != arbiterPk inside complete(). Adds on-chain cost but prevents collusion by key reuse.',
    },
  ],
  crossFieldValidators: [makeDistinctPubkeyValidator(['buyerPk', 'sellerPk', 'arbiterPk'])],
  build: (opts): BuildOutput => {
    const wantCap = !!opts.enabled.partialRelease;
    const wantOracle = !!opts.enabled.oracleDataSig;
    const strict = !!opts.enabled.strictDistinctKeys;

    const completeBody: string[] = [
      'require(checkSig(buyerSig, buyerPk));',
      'require(checkSig(sellerSig, sellerPk));',
    ];
    if (wantCap) completeBody.push('require(tx.outputs[0].value <= releaseCapSats);');

    const complete: FunctionSpec = wantCap
      ? {
          name: 'complete',
          role: 'bound-payout',
          params: ['sig buyerSig', 'sig sellerSig'],
          body: completeBody,
          extraInvariants: strict ? ['DISTINCT_PUBKEYS'] : [],
          invariantParams: {
            boundRecipient: { lockingBytecodeParam: 'sellerLockingBytecode' },
            ...(strict ? { distinctPubkeys: ['buyerPk', 'sellerPk', 'arbiterPk'] } : {}),
          },
        }
      : {
          name: 'complete',
          role: 'quorum-spend',
          params: ['sig buyerSig', 'sig sellerSig'],
          body: completeBody,
          extraInvariants: strict ? ['DISTINCT_PUBKEYS'] : [],
          invariantParams: strict
            ? { distinctPubkeys: ['buyerPk', 'sellerPk', 'arbiterPk'] }
            : undefined,
        };

    const arbitrate = (
      fnName: string,
      partySigName: string,
      partyPk: string,
      lockingBytecodeParam: string,
      applyCap: boolean,
    ): FunctionSpec => {
      const params = ['sig arbiterSig', `sig ${partySigName}`];
      if (wantOracle) params.push('datasig oracleSig', 'bytes oracleMessage');
      const body: string[] = [
        'require(checkSig(arbiterSig, arbiterPk));',
        `require(checkSig(${partySigName}, ${partyPk}));`,
      ];
      if (wantOracle) body.push('require(checkDataSig(oracleSig, oracleMessage, oraclePk));');
      if (applyCap) body.push('require(tx.outputs[0].value <= releaseCapSats);');
      return {
        name: fnName,
        role: 'bound-payout',
        params,
        body,
        invariantParams: {
          boundRecipient: { lockingBytecodeParam },
        },
      };
    };

    const arbBuyer = arbitrate('arbitrateToBuyer', 'buyerSig', 'buyerPk', 'buyerLockingBytecode', false);
    const arbSeller = arbitrate('arbitrateToSeller', 'sellerSig', 'sellerPk', 'sellerLockingBytecode', wantCap);

    const timeoutRefund: FunctionSpec = {
      name: 'timeoutRefund',
      role: 'owner-escape',
      params: ['sig buyerSig'],
      body: [
        'require(this.age >= timeoutHeight);',
        'require(checkSig(buyerSig, buyerPk));',
      ],
    };

    return { functions: [complete, arbBuyer, arbSeller, timeoutRefund] };
  },
};
