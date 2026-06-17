// MUST stay in sync with lib/registryGate.ts — shared gate rules for edge functions.
export {
  MIN_PUBLISH_SCORE,
  MIN_DEPLOY_SCORE,
  VERIFIED_SCORE,
  normalizeAuditScore,
  hasHighOrCriticalFindings,
  computeSourceHash,
  evaluatePublishEligibility,
  deriveValidationStatus,
  deriveVisibility,
  canDeploy,
  formatRejectionReason,
  bumpSemverPatch,
} from '../../../lib/registryGate.ts';

export type {
  RegistryValidationStatus,
  RegistryVisibility,
  PublishRejectionReason,
  PublishEligibilityInput,
  PublishEligibilityResult,
  DeployGateResult,
} from '../../../lib/registryGate.ts';
