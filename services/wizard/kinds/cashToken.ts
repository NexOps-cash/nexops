import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const cashTokenKind: ContractKind = {
  id: 'cashToken',
  name: 'CashTokenPolicy',
  summary: 'Secure CashToken policy with full output category coverage and optional total mint cap.',
  allowedRoles: ['token-mint'],
  fields: [
    {
      id: 'category',
      label: 'Token category',
      type: 'tokenCategory',
      description: '32-byte CashToken category (hex). Enforced on input 0 and output 0.',
    },
    {
      id: 'mintingPk',
      label: 'Minting authority key',
      type: 'pubkey',
      description: 'Key authorised to mint or release tokens under this policy.',
    },
  ],
  features: [
    {
      id: 'mintCap',
      label: 'Per-tx mint cap',
      group: 'Policy',
      description: 'Adds a per-transaction mint cap that limits total tokens minted across all outputs.',
      fields: [
        {
          id: 'maxMintPerTx',
          label: 'Max mint per tx',
          type: 'int',
          description: 'Set to 0 for unlimited minting, or non-zero to cap total minted amount across all outputs.',
          defaultValue: 0,
        },
      ],
    },
  ],
  build: (opts): BuildOutput => {
    const mintCapEnabled = !!opts.enabled.mintCap;

    const body: string[] = [
      'require(checkSig(authoritySig, mintingPk));',
      '',
      'require(tx.outputs.length == 1 || tx.outputs.length == 2);',
      '',
      'int totalMinted = tx.outputs[0].tokenAmount;',
      '',
      'require(tx.outputs[0].tokenCategory == category);',
      'if (tx.outputs.length == 2) {',
      '    require(tx.outputs[1].tokenCategory == category);',
      '    totalMinted = totalMinted + tx.outputs[1].tokenAmount;',
      '}',
      ...(mintCapEnabled
        ? [
            '',
            'if (maxMintPerTx != 0) {',
            '    require(totalMinted <= maxMintPerTx);',
            '}',
          ]
        : []),
      '',
      'require(tx.inputs.length <= 3);',
      '',
      'bool hasAuthority = false;',
      '',
      'if (tx.inputs.length >= 1) {',
      '    if (tx.inputs[0].tokenCategory == category) {',
      '        hasAuthority = true;',
      '    }',
      '}',
      '',
      'if (tx.inputs.length >= 2) {',
      '    if (tx.inputs[1].tokenCategory == category) {',
      '        hasAuthority = true;',
      '    }',
      '}',
      '',
      'if (tx.inputs.length >= 3) {',
      '    if (tx.inputs[2].tokenCategory == category) {',
      '        hasAuthority = true;',
      '    }',
      '}',
      '',
      'require(hasAuthority);',
    ];

    const mint: FunctionSpec = {
      name: 'mint',
      role: 'token-mint',
      params: ['sig authoritySig'],
      body,
      invariantParams: {
        tokenCategoryContinuity: { categoryParam: 'category' },
      },
    };

    return { functions: [mint] };
  },
};
