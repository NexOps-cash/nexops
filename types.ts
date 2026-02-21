
export enum ChainType {
  BCH_TESTNET = 'BCH Chipnet (Main)',
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
  score: number;
  vulnerabilities: Vulnerability[]; // Map from issues
  risk_level?: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  timestamp: number;
  metadata?: {
    compile_success: boolean;
    dsl_passed: boolean;
    structural_score: number;
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
  author: 'AI' | 'USER';
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
