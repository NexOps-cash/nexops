import { collectBlockFunctions, collectBlockGuards } from '../blocks';
import { ContractKind } from '../schema';

export const cashTokenKind: ContractKind = {
  id: 'cashToken',
  name: 'CashTokenPolicy',
  summary: 'Token-aware policy skeleton for category/mint/burn controls.',
  fields: [
    { id: 'category', label: 'Token category', type: 'tokenCategory', description: 'CashToken category (32-byte hex).' },
    { id: 'mintingPk', label: 'Minting authority key', type: 'pubkey', description: 'Key that authorizes mint path.' },
  ],
  features: [
    {
      id: 'fungible',
      label: 'Fungible token mode',
      group: 'Tokens',
      description: 'Enable fungible amount rule checks.',
      fields: [{ id: 'maxMintPerTx', label: 'Max mint per tx', type: 'int', description: 'Upper mint amount guard.', defaultValue: 1000 }],
    },
    {
      id: 'nftWithCommitment',
      label: 'NFT commitment mode',
      group: 'Tokens',
      description: 'Enable NFT commitment branch checks.',
      disabled: true,
      disabledReason: 'Coming soon',
    },
    {
      id: 'burnToClaim',
      label: 'Burn-to-claim path',
      group: 'Tokens',
      description: 'Require token burn before redemption.',
      disabled: true,
      disabledReason: 'Coming soon',
    },
  ],
  build: (opts) => {
    const blocks = ['mintingNft'];
    if (opts.enabled.burnToClaim) blocks.push('burnToClaim');
    const guards = collectBlockGuards(blocks);
    const functions = collectBlockFunctions(blocks);
    const source = [
      '    function mint(sig authoritySig, int mintAmount) {',
      '        require(checkSig(authoritySig, mintingPk));',
      ...(opts.enabled.fungible ? ['        require(mintAmount <= maxMintPerTx);'] : []),
      ...guards.map((g) => `        ${g}`),
      '    }',
      '',
      ...functions,
    ].join('\n');
    return { source, hash: '', warnings: [] };
  },
};
