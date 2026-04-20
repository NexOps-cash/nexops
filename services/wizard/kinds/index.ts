import { ContractKind } from '../schema';
import { cashTokenKind } from './cashToken';
import { covenantKind } from './covenant';
import { escrowKind } from './escrow';
import { htlcKind } from './htlc';
import { multisigKind } from './multisig';
import { vestingKind } from './vesting';

export const KINDS: ContractKind[] = [
  multisigKind,
  htlcKind,
  escrowKind,
  vestingKind,
  covenantKind,
  cashTokenKind,
];

export const KINDS_BY_ID: Record<string, ContractKind> = KINDS.reduce((acc, kind) => {
  acc[kind.id] = kind;
  return acc;
}, {} as Record<string, ContractKind>);
