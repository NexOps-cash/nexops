import { ContractKind } from '../schema';

export const htlcKind: ContractKind = {
  id: 'htlc',
  name: 'HashTimeLock',
  summary: 'Receiver claims with a preimage before timeout; sender refunds after relative timeout.',
  fields: [
    { id: 'senderPk', label: 'Sender pubkey', type: 'pubkey', description: 'Refund path signer.' },
    { id: 'receiverPk', label: 'Receiver pubkey', type: 'pubkey', description: 'Claim path signer.' },
    {
      id: 'digest160',
      label: 'Hash160 digest',
      type: 'bytes20',
      description: 'hash160(preimage). Override with SHA-256 feature if you prefer sha256.',
    },
    {
      id: 'timeoutHeight',
      label: 'Timeout (blocks)',
      type: 'blockHeight',
      description: 'Relative timelock in blocks (nSequence) before refund becomes available.',
      defaultValue: 144,
    },
  ],
  features: [
    {
      id: 'useSha256',
      label: 'Use SHA-256 digest',
      group: 'Tokens',
      description: 'Switch hash check from hash160 to sha256. Replaces the bytes20 digest with a bytes32 digest.',
      removesFields: ['digest160'],
      fields: [
        {
          id: 'digest256',
          label: 'SHA-256 digest',
          type: 'bytes32',
          description: 'sha256(preimage).',
        },
      ],
    },
  ],
  build: (opts) => {
    const useSha = !!opts.enabled.useSha256;
    const hashCheck = useSha
      ? 'require(sha256(secretPreimage) == digest256);'
      : 'require(hash160(secretPreimage) == digest160);';

    const lines = [
      '    function claim(sig receiverSig, bytes secretPreimage) {',
      '        require(checkSig(receiverSig, receiverPk));',
      `        ${hashCheck}`,
      '    }',
      '',
      '    function refund(sig senderSig) {',
      '        require(checkSig(senderSig, senderPk));',
      '        require(this.age >= timeoutHeight);',
      '    }',
    ];
    return { source: lines.join('\n'), hash: '', warnings: [] };
  },
};
