
export enum ChainType {
  BCH_TESTNET = 'BCH Chipnet',
}

export interface ExecutionRecord {
  txid: string;
  funcName: string;
  args: string[];
  timestamp: number;
  network: string;
}

export interface ContractArtifact {
  bytecode: string;
  scriptHash?: string;
  constructorInputs: { name: string; type: string }[];
  contractName: string;
  abi: any[];
  [key: string]: any;
}

export interface Vulnerability {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  line?: number;
  title: string;
  description: string;
  recommendation: string;
  rule_id?: string;
  can_fix?: boolean;
}

export interface AuditReport {
  score: number;             // maps to total_score
  total_score?: number;
  deterministic_score?: number;
  semantic_score?: number;
  semantic_category?: 'no_logic_risk' | 'low_logic_risk' | 'moderate_logic_risk' | 'high_logic_risk' | 'critical_logic_risk';
  deployment_allowed?: boolean;
  vulnerabilities: Vulnerability[]; // mapped from issues[]
  risk_level?: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  timestamp: number;
  metadata?: {
    compile_success: boolean;
    dsl_passed: boolean;
    structural_score: number;
    semantic_score?: number;
    contract_hash: string;
  };
  total_high?: number;
  total_medium?: number;
  total_low?: number;
}

export interface CodeVersion {
  id: string;
  timestamp: number;
  fileName: string;
  code: string;
  description: string;
  author: 'AI' | 'USER' | 'SYSTEM';
}

export interface ProjectFile {
  name: string;
  content: string;
  language: 'cashscript' | 'json' | 'typescript' | 'markdown';
  readOnly?: boolean;
}

export type RegistryValidationStatus = 'validated' | 'unsafe';
export type RegistryVisibility = 'community' | 'verified';

export interface RegistryContract {
  id: string;
  family_id: string;
  version: string;
  version_number: number;
  is_latest: boolean;
  title: string;
  description: string;
  intent_description?: string | null;
  source_code: string;
  bytecode: string;
  artifact: ContractArtifact | Record<string, unknown>;
  compiler_version: string;
  network: string;
  tags: string[];
  audit: AuditReport;
  audit_score: number;
  validation_status: RegistryValidationStatus;
  visibility: RegistryVisibility;
  author_id: string;
  author_display_name?: string | null;
  source_hash: string;
  project_id?: string | null;
  created_at: string;
}

export interface RegistryAuditLogEntry {
  id: string;
  contract_id: string | null;
  family_id: string | null;
  actor_id: string;
  action: 'published' | 'version_published' | 'rejected';
  details: Record<string, unknown>;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  chain: ChainType;
  contractCode: string;
  files: ProjectFile[];
  versions: CodeVersion[];
  auditReport?: AuditReport;
  lastModified: number;
  deployedAddress?: string;
  isFixing?: boolean;
  fixInstructions?: string;
  deployedArtifact?: ContractArtifact;
  constructorArgs?: string[];
  executionHistory?: ExecutionRecord[];
  deploymentRecord?: DeploymentRecord;
  registryFamilyId?: string;
  registryContractId?: string;
  registryIntentDescription?: string;
}

export interface GenerationResponse {
  code: string;
  explanation: string;
}

export interface StatusBarState {
  activeFileName?: string;
  isModified?: boolean;
  encoding?: string;
  language?: string;
  gitBranch?: string;
  activeChannel?: string;
  isTerminalActive?: boolean;
}

export interface BYOKSettings {
  apiKey: string;
  provider: 'groq' | 'openrouter';
}

export interface LocalWallet {
  id: string;
  name: string;
  wif: string;
  pubkey: string;
  address: string;
  network: 'chipnet' | 'mainnet';
  balance?: number; // Cached balance in sats
}

export interface DeploymentRecord {
  contractAddress: string;
  ownerWalletId: string;
  funderWalletId: string;
  constructorArgs: string[];
  timestamp: number;
}

/** Wizard deploy modal step machine (0–3 and error recovery). */
export type WizardDeployStep = 0 | 1 | 2 | 3 | 'error';

/** Persisted wizard deployments (localStorage) for history panel. */
export interface WizardDeployRecord {
  id: string;
  kindId: string;
  kindName: string;
  contractAddress: string;
  tokenAddress?: string;
  /** NexOps test identity selected under “Deploy identity context” when funded — guides spend signing. */
  deployIdentityWalletId?: string;
  deployIdentityWalletName?: string;
  constructorArgs: string[];
  wizardFieldSnapshot: Record<string, string | number | boolean>;
  /** Feature toggles at deploy time — used to resolve labels in history. */
  wizardEnabled?: Record<string, boolean>;
  invariants: string[];
  fundingTxid: string;
  fundingAmountSats: number;
  timestamp: number;
  network: 'chipnet';
  artifact: ContractArtifact;
}
