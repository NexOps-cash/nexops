import { BuildOutput, ContractKind, FunctionSpec } from '../schema';

export const cashTokenKind: ContractKind = {
  id: 'cashToken',
  name: 'CashTokenPolicy',
  summary: 'Category-bound CashToken mint path signed by a minting authority, with optional fungible cap.',
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
      id: 'fungible',
      label: 'Fungible cap',
      group: 'Tokens',
      description: 'Cap the fungible token amount on output 0 for each mint transaction.',
      fields: [
        {
          id: 'maxMintPerTx',
          label: 'Max mint per tx',
          type: 'int',
          description: 'Upper bound on tx.outputs[0].tokenAmount.',
          defaultValue: 1000,
        },
      ],
    },
  ],
  build: (opts): BuildOutput => {
    const body: string[] = [
      'require(checkSig(authoritySig, mintingPk));',
      'require(tx.inputs[0].tokenCategory == category);',
    ];
    if (opts.enabled.fungible) {
      body.push('require(tx.outputs[0].tokenAmount <= maxMintPerTx);');
    }

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
