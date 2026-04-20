import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const htlcKind: ContractKind = {
  id: 'htlc',
  name: 'HashTimeLock',
  summary: 'Receiver can claim with secret; sender can refund after timeout.',
  fields: [
    { id: 'senderPk', label: 'Sender pubkey', type: 'pubkey', description: 'Refund path signer.' },
    { id: 'receiverPk', label: 'Receiver pubkey', type: 'pubkey', description: 'Claim path signer.' },
    { id: 'digest160', label: 'Hash160 digest', type: 'bytes20', description: 'Expected hash160(secret).' },
    { id: 'timeoutHeight', label: 'Timeout height', type: 'blockHeight', description: 'Refund unlock block height.', defaultValue: 2000000 },
  ],
  features: [
    {
      id: 'hashSha256',
      label: 'Use SHA-256 digest',
      group: 'Tokens',
      description: 'Switch hash check to sha256(secret) with bytes32 digest.',
      conflicts: ['digest160Mode'],
      fields: [{ id: 'digest256', label: 'SHA-256 digest', type: 'bytes32', description: 'Expected sha256(secret).' }],
    },
    {
      id: 'digest160Mode',
      label: 'Use HASH160 digest',
      group: 'Tokens',
      description: 'Keep hash160(secret) digest flow.',
      defaultValue: true as any,
    } as any,
  ],
  build: (opts) => {
    const hashBlock = opts.enabled.hashSha256 ? 'htlcSha256' : 'htlcHash160';
    const guards = collectBlockGuards([hashBlock, 'timelockRelative']);
    const functions = collectBlockFunctions([hashBlock]);
    const source = [
      '    function claim(sig receiverSig, bytes secretPreimage) {',
      '        require(checkSig(receiverSig, receiverPk));',
      ...guards.filter((g) => !g.includes('tx.age')).map((g) => `        ${g}`),
      '    }',
      '',
      '    function refund(sig senderSig) {',
      '        require(checkSig(senderSig, senderPk));',
      '        require(tx.age >= timeoutHeight);',
      '    }',
      '',
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
