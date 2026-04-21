import { ContractKind } from '../schema';

export const escrowKind: ContractKind = {
  id: 'escrow',
  name: 'ArbitrationEscrow',
  summary: 'Two-party escrow with arbiter fallback and relative-time refund.',
  fields: [
    { id: 'buyerPk', label: 'Buyer pubkey', type: 'pubkey', description: 'Buyer signing key.' },
    { id: 'sellerPk', label: 'Seller pubkey', type: 'pubkey', description: 'Seller signing key.' },
    { id: 'arbiterPk', label: 'Arbiter pubkey', type: 'pubkey', description: 'Dispute resolver key.' },
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
      description: 'Cap the first output value (seller payout) for staged / partial releases.',
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
  ],
  build: (opts) => {
    const wantCap = !!opts.enabled.partialRelease;
    const wantOracle = !!opts.enabled.oracleDataSig;

    const completeLines = [
      '    function complete(sig buyerSig, sig sellerSig) {',
      '        require(checkSig(buyerSig, buyerPk));',
      '        require(checkSig(sellerSig, sellerPk));',
    ];
    if (wantCap) completeLines.push('        require(tx.outputs[0].value <= releaseCapSats);');
    completeLines.push('    }');

    /** Build one arbitration branch that keeps arbiterPk AND the participant key in use. */
    const arbitrate = (fnName: string, partySigName: string, partyPk: string): string[] => {
      const args = [`sig arbiterSig`, `sig ${partySigName}`];
      if (wantOracle) args.push('datasig oracleSig', 'bytes oracleMessage');
      const body: string[] = [
        `        require(checkSig(arbiterSig, arbiterPk));`,
        `        require(checkSig(${partySigName}, ${partyPk}));`,
      ];
      if (wantOracle) body.push('        require(checkDataSig(oracleSig, oracleMessage, oraclePk));');
      if (wantCap && partyPk === 'sellerPk') {
        body.push('        require(tx.outputs[0].value <= releaseCapSats);');
      }
      return [`    function ${fnName}(${args.join(', ')}) {`, ...body, '    }'];
    };

    const arbBuyer = arbitrate('arbitrateToBuyer', 'buyerSig', 'buyerPk');
    const arbSeller = arbitrate('arbitrateToSeller', 'sellerSig', 'sellerPk');

    const refundLines = [
      '    function timeoutRefund(sig buyerSig) {',
      '        require(this.age >= timeoutHeight);',
      '        require(checkSig(buyerSig, buyerPk));',
      '    }',
    ];

    const source = [
      ...completeLines,
      '',
      ...arbBuyer,
      '',
      ...arbSeller,
      '',
      ...refundLines,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
