import { CrossFieldValidator } from './schema';

/**
 * Build a cross-field validator that flags duplicate pubkey values across the
 * provided field ids. Returns an error per offending field id, keyed by the
 * second occurrence so the form highlights the duplicate input.
 */
export function makeDistinctPubkeyValidator(fieldIds: string[]): CrossFieldValidator {
  return (_kind, _enabled, values) => {
    const errors: Record<string, string> = {};
    const seen = new Map<string, string>();
    for (const id of fieldIds) {
      const raw = values[id];
      if (typeof raw !== 'string') continue;
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const firstId = seen.get(key);
      if (firstId) {
        errors[id] = `Must differ from "${firstId}".`;
      } else {
        seen.set(key, id);
      }
    }
    return errors;
  };
}
