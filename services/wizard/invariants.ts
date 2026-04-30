/**
 * NexWizard security invariant catalogue.
 *
 * Each invariant is a small, named set of CashScript `require(...)` lines
 * that the generator can inject around a function's business logic. Invariants
 * are keyed by identity (id + sorted params), merged deterministically, then
 * emitted in a fixed order so diffs and audits are stable.
 *
 * Identity-based dedupe lets two callers ask for the same guard without
 * producing duplicate require lines, while keeping the stricter of two
 * compatible variants (e.g. min for clamp-max, max for guard-min).
 */

export type InvariantId =
  | 'VALUE_PRESERVING_COVENANT'
  | 'OUTPUT_COUNT_GUARD'
  | 'OUTPUT_COUNT_CLAMP'
  | 'DISTINCT_PUBKEYS'
  | 'BOUND_RECIPIENT'
  | 'TOKEN_CATEGORY_CONTINUITY';

export type FunctionRole =
  | 'quorum-spend'
  | 'covenant-continuation'
  | 'bound-payout'
  | 'owner-spend'
  | 'owner-escape'
  | 'token-mint';

export interface InvariantInstance {
  id: InvariantId;
  /** Parameters that uniquely identify this instance (used for dedupe). */
  params: Record<string, string | number>;
  /** CashScript lines to emit. One line per array element, no trailing semicolons stripped. */
  lines: string[];
}

/** Regex used everywhere we check whether a body uses `tx.outputs[0]`. Whitespace-tolerant. */
export const TX_OUTPUT_ZERO_REGEX = /tx\.outputs\s*\[\s*0\s*\]/;

/**
 * Default role -> invariant table. Only `quorum-spend` may be empty; the
 * generator and tests enforce that every other role ships at least one
 * invariant before implications expand.
 */
export const ROLE_INVARIANTS: Record<FunctionRole, InvariantId[]> = {
  'quorum-spend': [],
  'covenant-continuation': ['VALUE_PRESERVING_COVENANT'],
  'bound-payout': ['BOUND_RECIPIENT', 'OUTPUT_COUNT_CLAMP'],
  'owner-spend': ['OUTPUT_COUNT_CLAMP'],
  'owner-escape': ['OUTPUT_COUNT_CLAMP'],
  'token-mint': ['OUTPUT_COUNT_CLAMP', 'TOKEN_CATEGORY_CONTINUITY'],
};

export function getInvariantsForRole(role: FunctionRole): InvariantId[] {
  return [...ROLE_INVARIANTS[role]];
}

/** Emission order after dedupe. Lower-index roles print first. */
const EMISSION_ORDER: InvariantId[] = [
  'OUTPUT_COUNT_GUARD',
  'OUTPUT_COUNT_CLAMP',
  'VALUE_PRESERVING_COVENANT',
  'BOUND_RECIPIENT',
  'TOKEN_CATEGORY_CONTINUITY',
  'DISTINCT_PUBKEYS',
];

function orderIndex(id: InvariantId): number {
  const idx = EMISSION_ORDER.indexOf(id);
  return idx < 0 ? EMISSION_ORDER.length : idx;
}

function sortedParamsKey(params: Record<string, string | number>): string {
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function identityKey(inst: InvariantInstance): string {
  return `${inst.id}|${sortedParamsKey(inst.params)}`;
}

export function valuePreservingCovenant(): InvariantInstance {
  return {
    id: 'VALUE_PRESERVING_COVENANT',
    params: {},
    lines: [
      'require(tx.outputs.length == 1);',
      'require(tx.outputs[0].lockingBytecode == tx.inputs[this.activeInputIndex].lockingBytecode);',
      'require(tx.outputs[0].value == tx.inputs[this.activeInputIndex].value);',
    ],
  };
}

export function outputCountGuard(min = 1): InvariantInstance {
  return {
    id: 'OUTPUT_COUNT_GUARD',
    params: { min },
    lines: [`require(tx.outputs.length >= ${min});`],
  };
}

export function outputCountClamp(max = 2): InvariantInstance {
  return {
    id: 'OUTPUT_COUNT_CLAMP',
    params: { max },
    lines: [`require(tx.outputs.length <= ${max});`],
  };
}

export function distinctPubkeys(keys: string[]): InvariantInstance {
  const unique = [...new Set(keys)];
  const lines: string[] = [];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      lines.push(`require(${unique[i]} != ${unique[j]});`);
    }
  }
  return {
    id: 'DISTINCT_PUBKEYS',
    params: { keys: unique.join(',') },
    lines,
  };
}

export function boundRecipient(lockingBytecodeParam: string): InvariantInstance {
  return {
    id: 'BOUND_RECIPIENT',
    params: { param: lockingBytecodeParam },
    lines: [`require(tx.outputs[0].lockingBytecode == ${lockingBytecodeParam});`],
  };
}

export function tokenCategoryContinuity(categoryParam: string): InvariantInstance {
  return {
    id: 'TOKEN_CATEGORY_CONTINUITY',
    params: { param: categoryParam },
    lines: [`require(tx.outputs[0].tokenCategory == ${categoryParam});`],
  };
}

export interface ComposeContext {
  role: FunctionRole;
  bodyJoined: string;
  extraInvariants?: InvariantId[];
  invariantParams?: {
    boundRecipient?: { lockingBytecodeParam: string };
    outputCountClamp?: number;
    outputCountGuard?: number;
    distinctPubkeys?: string[];
    tokenCategoryContinuity?: { categoryParam: string };
  };
}

function materialize(
  id: InvariantId,
  ctx: ComposeContext,
  fallbackClampMax: number
): InvariantInstance | null {
  const p = ctx.invariantParams ?? {};
  switch (id) {
    case 'VALUE_PRESERVING_COVENANT':
      return valuePreservingCovenant();
    case 'OUTPUT_COUNT_GUARD':
      return outputCountGuard(p.outputCountGuard ?? 1);
    case 'OUTPUT_COUNT_CLAMP':
      return outputCountClamp(p.outputCountClamp ?? fallbackClampMax);
    case 'BOUND_RECIPIENT': {
      if (!p.boundRecipient?.lockingBytecodeParam) {
        throw new Error(
          `BOUND_RECIPIENT requires invariantParams.boundRecipient.lockingBytecodeParam (role=${ctx.role}).`
        );
      }
      return boundRecipient(p.boundRecipient.lockingBytecodeParam);
    }
    case 'TOKEN_CATEGORY_CONTINUITY': {
      if (!p.tokenCategoryContinuity?.categoryParam) {
        throw new Error(
          `TOKEN_CATEGORY_CONTINUITY requires invariantParams.tokenCategoryContinuity.categoryParam (role=${ctx.role}).`
        );
      }
      return tokenCategoryContinuity(p.tokenCategoryContinuity.categoryParam);
    }
    case 'DISTINCT_PUBKEYS': {
      const keys = p.distinctPubkeys ?? [];
      if (keys.length < 2) return null;
      return distinctPubkeys(keys);
    }
    default:
      return null;
  }
}

function mergeInto(
  bucket: Map<string, InvariantInstance>,
  inst: InvariantInstance | null
): void {
  if (!inst) return;
  const key = identityKey(inst);
  const existing = bucket.get(key);
  if (!existing) {
    bucket.set(key, inst);
    return;
  }
  // Same identity (id + params). Safe no-op.
  if (JSON.stringify(existing.lines) === JSON.stringify(inst.lines)) return;
  throw new Error(
    `Invariant identity collision with different lines for ${inst.id} (params: ${sortedParamsKey(
      inst.params
    )}).`
  );
}

function mergeClampGuards(
  instances: InvariantInstance[]
): InvariantInstance[] {
  const clamps = instances.filter((i) => i.id === 'OUTPUT_COUNT_CLAMP');
  const guards = instances.filter((i) => i.id === 'OUTPUT_COUNT_GUARD');
  const rest = instances.filter(
    (i) => i.id !== 'OUTPUT_COUNT_CLAMP' && i.id !== 'OUTPUT_COUNT_GUARD'
  );

  const out: InvariantInstance[] = [...rest];

  if (clamps.length) {
    const min = clamps.reduce((m, c) => Math.min(m, Number(c.params.max)), Number.POSITIVE_INFINITY);
    out.push(outputCountClamp(min));
  }
  if (guards.length) {
    const max = guards.reduce((m, g) => Math.max(m, Number(g.params.min)), 0);
    out.push(outputCountGuard(max));
  }

  return out;
}

export interface ComposeResult {
  /** Ordered instances, already deduped and merged. */
  instances: InvariantInstance[];
  /** Flat list of invariant lines, indented by the caller. */
  lines: string[];
  /** Invariant IDs in emission order (for `@nexops-invariants` comment). */
  ids: InvariantId[];
}

/**
 * Compose the final set of invariants for a function.
 *
 * Steps match the plan's generator pipeline:
 *   1. seed from ROLE_INVARIANTS[role] + extraInvariants
 *   2. expand implications (VPC/BOUND/TOKEN all imply OCG(1); BOUND implies OCC)
 *   3. auto-inject OUTPUT_COUNT_GUARD(1) if body references tx.outputs[0]
 *   4. dedupe by identity + merge clamp/guard (min/max)
 *   5. enforce "non-quorum role must emit at least one invariant"
 *   6. sort by fixed emission order
 */
export function composeFunctionInvariants(ctx: ComposeContext): ComposeResult {
  const roleDefaults = getInvariantsForRole(ctx.role);
  const seeded: InvariantId[] = [...roleDefaults, ...(ctx.extraInvariants ?? [])];

  const clampFallback = ctx.invariantParams?.outputCountClamp ?? 2;

  const bucket = new Map<string, InvariantInstance>();

  // 1 + 2: seed + implications.
  for (const id of seeded) {
    switch (id) {
      case 'VALUE_PRESERVING_COVENANT':
        mergeInto(bucket, valuePreservingCovenant());
        mergeInto(bucket, outputCountGuard(1));
        break;
      case 'BOUND_RECIPIENT':
        mergeInto(bucket, materialize('BOUND_RECIPIENT', ctx, clampFallback));
        mergeInto(bucket, outputCountGuard(1));
        mergeInto(bucket, outputCountClamp(clampFallback));
        break;
      case 'TOKEN_CATEGORY_CONTINUITY':
        mergeInto(bucket, materialize('TOKEN_CATEGORY_CONTINUITY', ctx, clampFallback));
        mergeInto(bucket, outputCountGuard(1));
        break;
      default:
        mergeInto(bucket, materialize(id, ctx, clampFallback));
        break;
    }
  }

  // 3: auto-inject output guard if the body touches tx.outputs[0].
  if (TX_OUTPUT_ZERO_REGEX.test(ctx.bodyJoined)) {
    mergeInto(bucket, outputCountGuard(1));
  }

  // 4: merge clamp/guard families (min/max), leave everything else as-is.
  let merged = mergeClampGuards(Array.from(bucket.values()));

  // VPC's `outputs.length == 1` strictly satisfies any OCG(1) / OCC(1). Drop
  // those so we don't emit a redundant `length >= 1` / `length <= 1` line.
  const hasVpc = merged.some((i) => i.id === 'VALUE_PRESERVING_COVENANT');
  if (hasVpc) {
    merged = merged.filter((i) => {
      if (i.id === 'OUTPUT_COUNT_GUARD' && Number(i.params.min) <= 1) return false;
      if (i.id === 'OUTPUT_COUNT_CLAMP' && Number(i.params.max) >= 1) return false;
      return true;
    });
  }

  // 5: non-empty guard for non-quorum roles.
  if (ctx.role !== 'quorum-spend' && merged.length === 0) {
    throw new Error(
      `Role ${ctx.role} resolved to zero invariants. Check ROLE_INVARIANTS for silent regression.`
    );
  }

  // 6: emit in deterministic order.
  merged.sort((a, b) => {
    const d = orderIndex(a.id) - orderIndex(b.id);
    if (d !== 0) return d;
    return sortedParamsKey(a.params).localeCompare(sortedParamsKey(b.params));
  });

  const lines = merged.flatMap((inst) => inst.lines);
  const ids = merged.map((inst) => inst.id);
  return { instances: merged, lines, ids };
}
