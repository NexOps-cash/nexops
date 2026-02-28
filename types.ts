
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
  timestamp: number;
}
