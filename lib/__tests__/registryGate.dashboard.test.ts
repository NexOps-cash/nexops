import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  MIN_DEPLOY_SCORE,
  MIN_PUBLISH_SCORE,
  REGISTRY_COMPILER_VERSION,
  VERIFIED_SCORE,
} from '../registryGate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DASHBOARD_PATH = join(__dirname, '../../supabase/functions/publish-contract/index.dashboard.ts');
const GATE_START = '// --- registryGate (inlined for dashboard deploy) ---';
const GATE_END = '// --- end registryGate ---';

function extractDashboardGateSection(): string {
  const dashboard = readFileSync(DASHBOARD_PATH, 'utf8');
  const start = dashboard.indexOf(GATE_START);
  const end = dashboard.indexOf(GATE_END);
  if (start === -1 || end === -1) throw new Error('Dashboard gate markers missing');
  return dashboard.slice(start, end);
}

describe('registryGate dashboard inline parity', () => {
  const gateSection = extractDashboardGateSection();

  it('uses non-exported inline functions (paste-deploy bundle)', () => {
    expect(gateSection).not.toMatch(/^export /m);
    expect(gateSection).toContain('function evaluatePublishEligibility');
    expect(gateSection).toContain('function normalizeRegistryNetwork');
  });

  it('matches lib threshold constants', () => {
    expect(gateSection).toContain(`const MIN_PUBLISH_SCORE = ${MIN_PUBLISH_SCORE}`);
    expect(gateSection).toContain(`const MIN_DEPLOY_SCORE = ${MIN_DEPLOY_SCORE}`);
    expect(gateSection).toContain(`const VERIFIED_SCORE = ${VERIFIED_SCORE}`);
    expect(gateSection).toContain(`const REGISTRY_COMPILER_VERSION = '${REGISTRY_COMPILER_VERSION}'`);
  });

  it('includes stale-audit and network normalization helpers', () => {
    expect(gateSection).toContain('function computeSourceHash');
    expect(gateSection).toContain('function isUnboundContractHash');
    expect(gateSection).toContain('function normalizeRegistryNetwork');
  });
});
