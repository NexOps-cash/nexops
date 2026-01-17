
export enum PageView {
  DASHBOARD = 'DASHBOARD',
  GENERATOR = 'GENERATOR',
  AUDITOR = 'AUDITOR',
  DEPLOYMENT = 'DEPLOYMENT',
  DOCS = 'DOCS',
  SETTINGS = 'SETTINGS',
  CREATE_PROJECT = 'CREATE_PROJECT',
  PROJECT_WORKSPACE = 'PROJECT_WORKSPACE'
}

export enum ChainType {
  BCH_TESTNET = 'BCH Chipnet (Main)',
}

export interface Vulnerability {
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  line?: number;
  title: string;
  description: string;
  fixSuggestion: string;
}

export interface AuditReport {
  score: number;
  vulnerabilities: Vulnerability[];
  summary: string;
  timestamp: number;
}

export interface CodeVersion {
  id: string;
  timestamp: number;
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
