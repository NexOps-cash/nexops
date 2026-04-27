import { BuildOutput, ContractKind, FunctionSpec } from '../schema';
import { makeDistinctPubkeyValidator } from '../crossFieldValidators';

export const htlcKind: ContractKind = {
  id: 'htlc',
  name: 'HashTimeLock',
  summary: 'Secure single-template HTLC with hash-mode switch, strict one-output control, and value preservation.',
  allowedRoles: ['quorum-spend'],
  fields: [
    { id: 'senderPk', label: 'Sender pubkey', type: 'pubkey', description: 'Refund path signer.' },
    { id: 'receiverPk', label: 'Receiver pubkey', type: 'pubkey', description: 'Claim path signer.' },
    {
      id: 'timeoutHeight',
      label: 'Timeout (blocks)',
      type: 'blockHeight',
      description: 'Relative timelock in blocks (nSequence) before refund becomes available.',
      defaultValue: 144,
    },
    {
      id: 'digest20',
      label: 'HASH160 digest (bytes20)',
      type: 'bytes20',
      description: '20-byte hash160(preimage), used when hashMode == 0.',
    },
    {
      id: 'digest32',
      label: 'SHA256 digest (bytes32)',
      type: 'bytes32',
      description: '32-byte sha256(preimage), used when hashMode == 1.',
    },
    {
      id: 'hashMode',
      label: 'Hash mode',
      type: 'int',
      description: '0 = HASH160, 1 = SHA256.',
      defaultValue: 0,
    },
  ],
  features: [
    {
      id: 'strictDistinctKeys',
      label: 'On-chain distinct keys',
      group: 'Policy',
      description: 'Add require(senderPk != receiverPk); inside both claim() and refund().',
    },
  ],
  crossFieldValidators: [makeDistinctPubkeyValidator(['senderPk', 'receiverPk'])],
  build: (opts): BuildOutput => {
    const strict = !!opts.enabled.strictDistinctKeys;

    const claim: FunctionSpec = {
      name: 'claim',
      role: 'quorum-spend',
      params: ['sig receiverSig', 'bytes preimage'],
      body: [
        'require(checkSig(receiverSig, receiverPk));',
        ...(strict ? ['require(senderPk != receiverPk);'] : []),
        '',
        'if (hashMode == 0) {',
        '    require(hash160(preimage) == digest20);',
        '} else {',
        '    require(sha256(preimage) == digest32);',
        '}',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
      ],
    };

    const refund: FunctionSpec = {
      name: 'refund',
      role: 'quorum-spend',
      params: ['sig senderSig'],
      body: [
        'require(checkSig(senderSig, senderPk));',
        ...(strict ? ['require(senderPk != receiverPk);'] : []),
        'require(this.age >= timeoutHeight);',
        '',
        'require(tx.outputs.length == 1);',
        'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
      ],
    };

    return { functions: [claim, refund] };
  },
};
