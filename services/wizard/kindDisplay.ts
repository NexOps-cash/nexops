/**
 * Turns PascalCase wizard kind names (e.g. MultisigVault) into readable spaced titles.
 * Leaves strings that already contain spaces or separators unchanged.
 */
export function formatKindDisplayLabel(name: string): string {
  const t = name.trim();
  if (/[\s_-]/.test(t)) return t;
  return t.replace(/([A-Z])/g, ' $1').trim();
}
