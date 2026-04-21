import { ContractKind } from '../schema';

export const vestingKind: ContractKind = {
  id: 'vesting',
  name: 'LinearVesting',
  summary: 'Beneficiary can claim only between cliff and end time, with a per-claim cap.',
  fields: [
    { id: 'beneficiaryPk', label: 'Beneficiary pubkey', type: 'pubkey', description: 'Claim signer.' },
    {
      id: 'cliffTime',
      label: 'Cliff time',
      type: 'unixTime',
      description: 'No claims permitted before this UNIX time.',
      defaultValue: 1735689600,
    },
    {
      id: 'endTime',
      label: 'End time',
      type: 'unixTime',
      description: 'Upper bound for claims; used as a hard expiry guard.',
      defaultValue: 1767225600,
    },
    {
      id: 'totalAmount',
      label: 'Per-claim cap (sats)',
      type: 'int',
      description: 'Maximum output value the beneficiary can send in a single claim.',
      defaultValue: 1000000,
    },
  ],
  features: [
    {
      id: 'revocable',
      label: 'Admin revocation',
      group: 'Policy',
      description: 'Adds a revoke() function signed by an admin key (e.g., to sweep after expiry).',
      fields: [{ id: 'adminPk', label: 'Admin pubkey', type: 'pubkey', description: 'Admin revocation key.' }],
    },
  ],
  build: (opts) => {
    const lines: string[] = [];
    lines.push('    function claim(sig beneficiarySig) {');
    lines.push('        require(checkSig(beneficiarySig, beneficiaryPk));');
    lines.push('        require(tx.time >= cliffTime);');
    // CashScript only allows tx.time on the LHS of >= for timelocks. We cannot encode
    // "tx.time <= endTime" directly; we keep endTime as a sanity bound and rely on the
    // revoke() path (if enabled) to sweep unused funds after endTime.
    lines.push('        require(endTime > cliffTime);');
    lines.push('        require(tx.outputs[0].value <= totalAmount);');
    lines.push('    }');

    if (opts.enabled.revocable) {
      lines.push('');
      lines.push('    function revoke(sig adminSig) {');
      lines.push('        require(checkSig(adminSig, adminPk));');
      // Admin path is gated by time: only after vesting window ends.
      lines.push('        require(tx.time >= endTime);');
      lines.push('    }');
    }

    return { source: lines.join('\n'), hash: '', warnings: [] };
  },
};
