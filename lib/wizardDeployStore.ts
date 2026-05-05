import type { WizardDeployRecord } from '../types';

const STORAGE_KEY = 'nexops_wizard_deployments';

function safeParse(raw: string | null): WizardDeployRecord[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is WizardDeployRecord => x && typeof x === 'object' && typeof (x as WizardDeployRecord).id === 'string');
  } catch {
    return [];
  }
}

export function getWizardDeploys(): WizardDeployRecord[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function addWizardDeploy(record: WizardDeployRecord): void {
  if (typeof localStorage === 'undefined') return;
  const prev = getWizardDeploys();
  const next = [record, ...prev].slice(0, 200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearWizardDeploys(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
