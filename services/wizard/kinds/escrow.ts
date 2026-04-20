import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const escrowKind: ContractKind = {
  id: 'escrow',
  name: 'ArbitrationEscrow',
  summary: 'Two-party escrow with arbiter and timeout recovery.',
  fields: [
    { id: 'buyerPk', label: 'Buyer pubkey', type: 'pubkey', description: 'Buyer key.' },
    { id: 'sellerPk', label: 'Seller pubkey', type: 'pubkey', description: 'Seller key.' },
    { id: 'arbiterPk', label: 'Arbiter pubkey', type: 'pubkey', description: 'Dispute resolver key.' },
    { id: 'timeoutHeight', label: 'Timeout height', type: 'blockHeight', description: 'Refund unlock height.', defaultValue: 2100000 },
  ],
  features: [
    {
      id: 'partialRelease',
      label: 'Partial release cap',
      group: 'Outputs',
      description: 'Cap seller output value for staged releases.',
      fields: [{ id: 'releaseCapSats', label: 'Release cap (sats)', type: 'int', description: 'Max value to seller output.', defaultValue: 100000 }],
    },
    {
      id: 'oracleDataSig',
      label: 'Oracle attestation',
      group: 'Policy',
      description: 'Require signed oracle statement for dispute resolves.',
      fields: [{ id: 'oraclePk', label: 'Oracle pubkey', type: 'pubkey', description: 'Oracle signer key.' }],
    },
  ],
  build: (opts) => {
    const blocks: string[] = [];
    if (opts.enabled.partialRelease) blocks.push('partialRelease');
    if (opts.enabled.oracleDataSig) blocks.push('oracleDataSig');
    const guards = collectBlockGuards(blocks);
    const functions = collectBlockFunctions(blocks);

    const source = [
      '    function complete(sig buyerSig, sig sellerSig) {',
      '        require(checkSig(buyerSig, buyerPk));',
      '        require(checkSig(sellerSig, sellerPk));',
      ...guards.map((g) => `        ${g}`),
      '    }',
      '',
      '    function disputeResolve(sig arbiterSig, sig participantSig, datasig oracleSig, bytes oracleMessage) {',
      '        require(checkSig(arbiterSig, arbiterPk));',
      '        require(checkSig(participantSig, buyerPk) || checkSig(participantSig, sellerPk));',
      ...guards.filter((g) => g.includes('checkDataSig')).map((g) => `        ${g}`),
      '    }',
      '',
      '    function timeoutRefund(sig buyerSig) {',
      '        require(tx.age >= timeoutHeight);',
      '        require(checkSig(buyerSig, buyerPk));',
      '    }',
      '',
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
