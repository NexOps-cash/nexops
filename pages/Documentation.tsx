import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DocsLayout } from '../components/DocsLayout';
import {
  Tag, Lead, SectionH2, SectionH3, Para, Code, CodeBlock, InfoBox,
  BulletList, OrderedList, Table, Pipeline, CardGrid, Quote, PageTitle,
  SeverityBadge, StepRow
} from '../components/DocComponents';

const G = '#00D855';

// ─── Section content map ────────────────────────────────────────────────────
const sections: Record<string, React.ReactNode> = {

  introduction: (
    <>
      <Tag>Technical Whitepaper v4.0</Tag>
      <PageTitle>NexOps Protocol Documentation</PageTitle>
      <Quote>"The goal of NexOps is not to replace the developer. It is to make the developer's work provably safe."</Quote>
      <Lead>NexOps is a Safety-First AI Synthesis Engine for Bitcoin Cash. Every smart contract passes through a four-phase guarded pipeline guaranteeing deterministic security verification before deployment.</Lead>
      <SectionH2>What You'll Learn</SectionH2>
      <BulletList items={[
        '**Intent-Based Development** — express what you want, not how to write it',
        '**Guarded Synthesis Pipeline** — four-phase protected contract generation',
        '**TollGate Verification** — 14+ vulnerability patterns caught deterministically',
        '**Audit Reports** — human-readable verification you can independently check',
      ]} />
      <SectionH2>Quick Navigation</SectionH2>
      <CardGrid cards={[
        { title:'Getting Started', body:'Core concepts and the protocol pipeline. Start here.',accent:G },
        { title:'Core Protocol', body:'Deep technical internals — NexIR, TollGate, Scoring.', accent:'#818cf8' },
        { title:'Developer Guide', body:'Practical tutorials for writing, compiling, deploying.',accent:'#38bdf8' },
        { title:'Security', body:'Trust model, threat analysis, and LNC compliance.',accent:'#fb923c' },
      ]} />
    </>
  ),

  'what-is-nexops': (
    <>
      <PageTitle>What is NexOps</PageTitle>
      <Lead>NexOps is a protocol for generating secure Bitcoin Cash smart contracts from high-level developer intent using deterministic compilation and automated security verification.</Lead>
      <SectionH2>Three Pillars</SectionH2>
      <CardGrid cards={[
        { title:'Intent-Based Development', body:'Express what you want the contract to do. NexOps handles the translation to CashScript.', accent:G },
        { title:'Deterministic Generation', body:'The same intent always produces the same verified code. Fully reproducible and auditable.', accent:'#818cf8' },
        { title:'Security-First Design', body:'Every contract is checked against 20 LNC rules and 14 Anti-Pattern Detectors before delivery.', accent:'#fb923c' },
      ]} />
      <SectionH2>How It Differs</SectionH2>
      <Table head={['Feature','NexOps','Generic AI Tools']} rows={[
        ['Security Audit','✅ Deterministic (AST-based)','❌ Probabilistic (AI opinion)'],
        ['BCH-Native','✅ Zero EVM assumptions','❌ Often EVM-biased'],
        ['Reproducible','✅ Same input → same output','❌ Different every run'],
        ['Transparency','✅ Full audit report with rule IDs','❌ Black-box output'],
      ]} />
    </>
  ),

  'why-nexops': (
    <>
      <PageTitle>Why NexOps Exists</PageTitle>
      <SectionH2>The AI-Finance Gap</SectionH2>
      <Para>The rise of LLM code generation has created a paradox in DeFi. AI can write thousands of lines per second — but it cannot reliably guarantee security invariants. This is uniquely dangerous on Bitcoin Cash:</Para>
      <BulletList items={[
        '**Code is immutable once deployed.** No proxy contracts, no admin keys, no recovery mechanism.',
        '**Funds are locked by bytecode.** A single missing `require()` can freeze millions permanently.',
        '**BCH VM has strict binary semantics.** A failed script terminates — it does not return `false`.',
      ]} />
      <InfoBox type="critical">Standard LLMs are trained on EVM-dominant data and routinely apply Ethereum mental models to Bitcoin Script — producing code that looks plausible but is fundamentally insecure.</InfoBox>
      <SectionH2>The Trust Guarantee</SectionH2>
      <Quote>Every contract that passes the NexOps TollGate has been verified by a deterministic, non-AI rule engine against 14+ specific vulnerability patterns. The AI can hallucinate anything — but it cannot pass a deterministic AST check with a known exploit.</Quote>
    </>
  ),

  'architecture-overview': (
    <>
      <PageTitle>Architecture Overview</PageTitle>
      <Lead>NexOps is organized into four horizontal layers. Each layer has strict responsibilities and cannot bypass the one below it.</Lead>
      <Pipeline steps={[
        { label:'Developer Intent', desc:'Plain-language description of desired contract behavior' },
        { label:'Layer 1 — MCP / API Interface', desc:'Routes requests from clients to the pipeline controller', color:'#818cf8' },
        { label:'Layer 2 — Synthesis Engine', desc:'Phase 1: Skeletonization → Phase 2: Logic Injection', color:'#38bdf8' },
        { label:'Layer 3 — TollGate Enforcement', desc:'20 LNC rules + 14 Anti-Pattern detectors (non-AI)', color:'#fb923c' },
        { label:'Layer 4 — Deterministic Deployment', desc:'Bytecode + P2SH32 address + full audit report', color:G },
      ]} />
      <SectionH2>Layer Responsibilities</SectionH2>
      <Table head={['Layer','Role','Can Bypass Security?']} rows={[
        ['**Layer 1 — Interface**','Route requests from MCP/API clients','No'],
        ['**Layer 2 — Synthesis**','AI-driven NexIR generation and logic injection','No — all output flows to L3'],
        ['**Layer 3 — Enforcement**','Deterministic rule checking (TollGate)','**This IS the security layer**'],
        ['**Layer 4 — Grounding**','BCH Knowledge Base — read-only input','No'],
      ]} />
      <SectionH2>Contract Lifecycle</SectionH2>
      {[
        ['1','Intent Classification','IQS scored, semantic tags extracted, KB tier selected'],
        ['2','Phase 1 — Skeletonization','NexIR structural JSON produced without any CashScript logic'],
        ['3','Phase 2 — Logic Injection','KB-grounded LLM Synthesizer writes CashScript targeting NexIR'],
        ['4','Phase 3 — TollGate','AST parser runs 20 LNC rules + 14 anti-pattern detectors'],
        ['5','Phase 4 — Repair or Deliver','Violations → repair loop; Clean → bytecode + audit report delivered'],
      ].map(([n,t,d]) => <StepRow key={n as string} n={parseInt(n as string)} title={t as string} desc={d as string} />)}
    </>
  ),

  'intent-spec': (
    <>
      <PageTitle>Intent Specification</PageTitle>
      <Lead>An intent is a plain-language description of the contract you want to build. NexOps classifies it semantically before any code is generated.</Lead>
      <SectionH2>Schema</SectionH2>
      <CodeBlock lang="intent" code={`intent {\n  name: "Escrow"\n  network: "chipnet"\n  parameters: {\n    sender: pubkey\n    recipient: pubkey\n    timeout: block_height\n  }\n  rules: [\n    "2-of-2 multisig release",\n    "sender refund after timeout"\n  ]\n}`} />
      <SectionH2>Intent Quality Score (IQS)</SectionH2>
      <Table head={['IQS Range','Classification','Action']} rows={[
        ['≥ 0.8','High — clear domain keywords, explicit auth model','Proceed with Tier 1 KB injection'],
        ['0.5–0.8','Medium — clear intent but lacks specifics','Draft NexIR with flagged assumptions'],
        ['< 0.5','Low — ambiguous or missing critical parameters','Request structured clarification'],
      ]} />
      <SectionH2>Golden Keywords</SectionH2>
      <Table head={['Keyword','Triggers','KB Pattern Injected']} rows={[
        ['"Vault", "Lockbox"','STATEFUL + COVENANT','escrow_2of3.cash'],
        ['"Vesting", "Cliff"','STATEFUL + TEMPORAL','linear_vesting.cash'],
        ['"Atomic Swap", "HTLC"','STATELESS + SIGNATURE','htlc_pattern.cash'],
        ['"DAO", "Multi-sig"','MULTI_CONTRACT + SIGNATURE','multisig_2of3.cash'],
      ]} />
    </>
  ),

  nexir: (
    <>
      <PageTitle>NexIR — Synthesis Intermediate Representation</PageTitle>
      <Lead>NexIR is the pipeline's internal blueprint — a JSON schema describing contract architecture without any business logic. It prevents Schema Drift before synthesis begins.</Lead>
      <SectionH2>Why It Exists</SectionH2>
      <Para>NexIR prevents <strong style={{color:'#d4d4d8'}}>Schema Drift</strong> — where an LLM generates plausible business logic but with wrong parameter types, missing constructor fields, or mismatched function signatures. By validating structure before logic, we catch shape errors without spending synthesis tokens.</Para>
      <SectionH2>NexIR Specification (LinearVesting Example)</SectionH2>
      <CodeBlock lang="json" code={`{\n  "schema_version": "1.0",\n  "contract_meta": {\n    "name": "LinearVesting",\n    "pragma": "^0.13.0",\n    "statefulness": "STATEFUL",\n    "token_aware": true\n  },\n  "constructor": [\n    {"name": "beneficiary", "type": "pubkey", "role": "authorization"},\n    {"name": "startBlock",  "type": "int",    "role": "temporal_lower"},\n    {"name": "cliffBlock",  "type": "int",    "role": "temporal_upper"},\n    {"name": "totalAmount", "type": "int",    "role": "value_reference"}\n  ],\n  "functions": [{\n    "name": "vest",\n    "params": [{"name": "beneficiarySig", "type": "sig"}],\n    "spending_paths": ["AUTHORIZE_AND_TRANSFER"],\n    "covenant_required": true\n  }],\n  "structural_elements": {\n    "requires_output_limit": true,\n    "requires_self_anchor": true,\n    "requires_value_anchor": true\n  }\n}`} />
      <InfoBox>Phase 1 explicitly forbids the LLM from writing any logic. If output is not valid NexIR JSON, Phase 1 retries before consuming Phase 2 tokens.</InfoBox>
    </>
  ),

  'logic-injection': (
    <>
      <PageTitle>Phase 2: Knowledge-Grounded Logic Injection</PageTitle>
      <Lead>Phase 2 bridges high-level intent to low-level VM constraints using Tiered Knowledge Injection (TKI) — a targeted context strategy that avoids token bloat.</Lead>
      <SectionH2>Tiered Knowledge Injection</SectionH2>
      <Table head={['Tier','Content','When Injected']} rows={[
        ['**Tier 0**','`core_language.yaml` — types, builtins, critical gotchas','Every prompt, always'],
        ['**Tier 1**','`covenant_security.yaml`, `FAQ_DISTILLED.md`','Matched to intent semantic tags'],
        ['**Tier 2**','`CORE_REFERENCE.md`, `SECURITY_ARCHITECTURE.md`','Retry escalation only (≥ 2 failures)'],
      ]} />
      <SectionH2>Retrieval Logic</SectionH2>
      <CodeBlock lang="python" code={`intent_tags = classifier.classify(user_intent)\n# e.g., {"STATEFUL", "TOKEN", "TEMPORAL"}\n\ncontext = [knowledge_retriever.core_language_rules]  # Tier 0 always\nfor tag in intent_tags:\n    context += knowledge_retriever.get_by_tag(tag)   # Tier 1 tag-matched`} />
      <SectionH2>Phase 2 Output Contract</SectionH2>
      <BulletList items={[
        'Valid CashScript syntax with `pragma cashscript ^0.X.Y;`',
        'Every constructor parameter from the NexIR must be present',
        'No Solidity keywords (`msg.sender`, `mapping`, `emit`, `uint256`)',
        'Function names must match the NexIR function list exactly',
      ]} />
      <InfoBox type="warn">Any violation of the Output Contract triggers immediate Phase 3 rejection before AST parsing begins.</InfoBox>
    </>
  ),

  tollgate: (
    <>
      <PageTitle>TollGate Verification</PageTitle>
      <Lead>Phase 3. Non-AI, non-bypassable, transparent, and reproducible. No contract reaches delivery without passing through it.</Lead>
      <SectionH2>Execution Order</SectionH2>
      <Pipeline steps={[
        { label:'1. Compilation Check', desc:'Can cashc compile this code at all?', color:'#818cf8' },
        { label:'2. LNC Lint (20 rules)', desc:'Syntax, signature, covenant, arithmetic, temporal rules', color:'#38bdf8' },
        { label:'3. AST Construction', desc:'Traversable syntax tree built from compiled output', color:'#fb923c' },
        { label:'4. Anti-Pattern Scan (14 detectors)', desc:'Exploit-modeled vulnerability checks against AST', color:'#f43f5e' },
        { label:'5. Score Calculation', desc:'Deterministic Score 0–70 + Semantic Score 0–30', color:G },
      ]} />
      <InfoBox type="critical">A CRITICAL violation immediately halts the TollGate with `passed=False`. Non-critical violations accumulate and reduce the score.</InfoBox>
      <SectionH2>TollGateResult Data Model</SectionH2>
      <CodeBlock lang="python" code={`@dataclass\nclass TollGateResult:\n    passed: bool\n    violations: list[Violation]\n    deterministic_score: int      # 0 to 70\n    compilation_succeeded: bool\n    lnc_rules_passed: int\n    anti_patterns_detected: int\n    code_fingerprint: str         # SHA-256 of input\n\n@dataclass\nclass Violation:\n    rule_id: str      # e.g. "LNC-003" or "APD-009"\n    severity: str     # CRITICAL | HIGH | MEDIUM | LOW\n    reason: str       # Why this code violates the rule\n    exploit: str      # Attack vector\n    fix_hint: str     # Canonical correction`} />
    </>
  ),

  deployment: (
    <>
      <PageTitle>Deterministic Deployment</PageTitle>
      <Lead>After passing the TollGate, the contract is compiled to final bytecode and delivered with a complete audit report. A passing score is necessary but not sufficient.</Lead>
      <SectionH2>Deployment Gate — All 4 Conditions Required</SectionH2>
      <Table head={['Condition','Threshold','Rationale']} rows={[
        ['Compilation','Must succeed','Non-compiling code cannot be deployed'],
        ['CRITICAL violations','0 allowed','CRITICAL = known exploit vector'],
        ['Semantic override','Not `funds_unspendable`','Permanently locked funds'],
        ['Total Score','≥ 75','Minimum bar for production deployment'],
      ]} />
      <SectionH2>Compliance Grades</SectionH2>
      <Table head={['Grade','Score','Status']} rows={[
        ['**A+**','100','Perfect. Zero violations. Optimal logic.'],
        ['**A**','90–99','Production-ready. Minor inefficiencies only.'],
        ['**B**','80–89','Deployable. Non-critical improvements available.'],
        ['**C**','75–79','Deployable. Structural warnings issued.'],
        ['**D**','60–74','❌ Not deployable. HIGH violations present.'],
        ['**F**','0–59','❌ Not deployable. CRITICAL failures.'],
      ]} />
    </>
  ),

  'writing-intents': (
    <>
      <PageTitle>Writing Intents</PageTitle>
      <Lead>An intent is your contract specification. Writing a high-quality intent directly determines the quality of the generated contract.</Lead>
      <SectionH2>Example Intent</SectionH2>
      <CodeBlock lang="intent" code={`intent {\n  name: "TwoPartyEscrow"\n  parameters: { sender: pubkey, recipient: pubkey, timeout: int }\n  rules: [\n    "2-of-2 multisig for release",\n    "sender can refund after timeout block"\n  ]\n}`} />
      <SectionH2>Best Practices</SectionH2>
      <BulletList items={[
        'Use **Golden Keywords** — "vault", "timelock", "HTLC", "vesting"',
        'Specify the **authorization model** explicitly (who signs, when)',
        'Include a **fallback path** (what if the primary path fails)',
        'Name parties explicitly: "Alice", "Bob", "admin", "recipient"',
        'Include a `timeout` even on simple contracts to prevent fund permanence',
      ]} />
      <InfoBox>Intents with IQS ≥ 0.8 produce significantly better NexIR. Include domain keywords and explicit authorization rules.</InfoBox>
    </>
  ),

  compiling: (
    <>
      <PageTitle>Compiling Contracts</PageTitle>
      <SectionH2>CLI</SectionH2>
      <CodeBlock lang="bash" code={`# Basic compilation\nnexops compile escrow.intent --network chipnet\n\n# Verbose — shows full audit report\nnexops compile vault.intent --verbose --network mainnet\n\n# Export compiled artifact\nnexops compile htlc.intent --output ./artifacts/`} />
      <SectionH2>Compilation Stages</SectionH2>
      {[
        ['1','Parse','Intent tokenized and classified into semantic tags (IQS scored)'],
        ['2','Skeletonize','Phase 1 produces NexIR structural schema'],
        ['3','Synthesize','Phase 2 injects CashScript logic via KB-grounded LLM'],
        ['4','Audit','Phase 3 runs 20 LNC rules + 14 anti-pattern detectors'],
        ['5','Deliver','Bytecode + P2SH32 address + audit report returned'],
      ].map(([n,t,d]) => <StepRow key={n as string} n={parseInt(n as string)} title={t as string} desc={d as string} />)}
    </>
  ),

  'security-verification': (
    <>
      <PageTitle>Security Verification</PageTitle>
      <Lead>Every NexOps contract includes a verifiable audit report. You do not need to trust the AI — you verify the deterministic findings.</Lead>
      <SectionH2>Reading the Audit Report</SectionH2>
      <CodeBlock lang="markdown" code={`## NexOps Audit Report\n- Code Fingerprint: SHA-256:e3b0c44298fc1c149...\n- Total Score: 87 / 100  (Grade: B)\n- Deployment Allowed: Yes\n\n### Deterministic Analysis (64/70)\n- LNC Rules: 20 checked / 18 passed / 2 failed\n  - LNC-016 [HIGH] Line 24: int share = amount / participants\n    Exploit: Pass participants=0 to brick this function.\n    Fix: Add require(participants > 0) before line 24.\n\n### Semantic Analysis (23/30)\n- Category: minor_inefficiency  Confidence: 0.88`} />
      <SectionH2>Third-Party Verification</SectionH2>
      <OrderedList items={[
        'Parse the generated code with any CashScript-compatible AST tool',
        'Walk through each LNC rule in the public registry',
        'Compare results with the NexOps report — deterministic output must match',
      ]} />
      <InfoBox>The `code_fingerprint` (SHA-256) proves the audit ran against the code you submitted, not an altered version.</InfoBox>
    </>
  ),

  deploying: (
    <>
      <PageTitle>Deploying Contracts</PageTitle>
      <SectionH2>Single Contract</SectionH2>
      <OrderedList items={[
        'Obtain the compiled P2SH32 address from the audit report',
        'Fund the address from a BCH wallet (Chipnet or Mainnet)',
        'Use **NexOps Workbench** to construct and broadcast spending transactions',
      ]} />
      <SectionH2>Multi-Contract (masterNFT)</SectionH2>
      <OrderedList items={[
        'Deploy all contracts separately → collect P2SH32 addresses',
        'If contracts reference each others addresses, hardcode them and recompile',
        'Execute the genesis transaction to create the Token Category',
        'Mint one masterNFT per contract from the genesis UTXO',
        'Send each masterNFT to its designated contract address',
        'Verify each contract holds its masterNFT before going live',
      ]} />
      <InfoBox type="warn">Step 2 means multi-contract protocols require two compilation passes if contracts reference each other's addresses.</InfoBox>
    </>
  ),

  interaction: (
    <>
      <PageTitle>Contract Interaction</PageTitle>
      <SectionH2>SDK Setup</SectionH2>
      <CodeBlock lang="bash" code={`npm install @nexops/protocol-sdk @cashscript/sdk`} />
      <SectionH2>Reading Contract State</SectionH2>
      <CodeBlock lang="typescript" code={`import { NexOpsClient } from '@nexops/protocol-sdk';\n\nconst client = new NexOpsClient({ network: 'chipnet' });\nconst utxos = await client.getContractUtxos(contractAddress);\nconst state = await client.decodeNftCommitment(utxos[0].token?.nft?.commitment);`} />
      <SectionH2>Spending a Contract</SectionH2>
      <CodeBlock lang="typescript" code={`const tx = await contract.functions\n  .spend(recipientSig)\n  .to(recipient, amount)\n  .withAge(timelock)\n  .send();\n\nconsole.log('txid:', tx.txid);`} />
    </>
  ),

  workbench: (
    <>
      <PageTitle>NexOps Workbench</PageTitle>
      <Lead>The primary developer IDE for NexOps — intent writing, compilation, UTXO monitoring, and transaction broadcasting in one environment.</Lead>
      <CardGrid cards={[
        { title:'Intent Editor', body:'Write and validate intents with real-time IQS scoring.' , accent:G },
        { title:'Live Audit Panel', body:'See violations, scores, and fix hints as you iterate.', accent:'#818cf8' },
        { title:'UTXO Monitor', body:'Track funds locked in contracts via Chipnet Electrum nodes.', accent:'#38bdf8' },
        { title:'Transaction Builder', body:'Construct spending transactions with visual parameter validation.', accent:'#fb923c' },
      ]} />
      <SectionH2>Electrum Network</SectionH2>
      <Para>The Workbench connects to a weighted server rotation pool of Chipnet Electrum nodes ensuring high-availability UTXO detection at ~120ms average query latency.</Para>
    </>
  ),

  nexhub: (
    <>
      <PageTitle>NexHub Registry</PageTitle>
      <Lead>Public registry of verified contract templates and community patterns. Every template has been audited to Grade A or above.</Lead>
      <CardGrid cards={[
        { title:'Canonical Templates', body:'Escrow, Multisig, Timelock, HTLC — production-ready starters.', accent:G },
        { title:'Community Patterns', body:'Vetted patterns contributed by BCH developers.', accent:'#818cf8' },
        { title:'Intent Sharing', body:'Publish your intent for others to fork and adapt.', accent:'#38bdf8' },
      ]} />
      <SectionH2>Submitting to NexHub</SectionH2>
      <OrderedList items={[
        'Generate a contract achieving Grade A or above',
        'Submit the intent + audit report to NexHub',
        'Community review period (48 hours)',
        'Template becomes publicly searchable and forkable',
      ]} />
    </>
  ),

  nexwizard: (
    <>
      <PageTitle>NexWizard Builder</PageTitle>
      <Lead>Low-code covenant builder — fill in fields, Wizard generates a valid intent that feeds directly into the synthesis pipeline.</Lead>
      <SectionH2>Available Templates</SectionH2>
      <Table head={['Template','Category','Complexity']} rows={[
        ['Multisig Vault (2-of-3)','Vault','Starter'],
        ['Time-Locked Escrow','Vault','Starter'],
        ['Fee Splitter','Utility','Starter'],
        ['Linear Vesting','Vesting','Policy'],
        ['Token Covenant Vault','DeFi','Policy'],
      ]} />
    </>
  ),

  'abi-visualizer': (
    <>
      <PageTitle>ABI Visualizer</PageTitle>
      <Lead>Renders a compiled contract's Application Binary Interface as an interactive diagram, showing all spending paths and authentication requirements.</Lead>
      <BulletList items={[
        'All contract **functions** and their required signatures',
        '**Spending path logic** — which keys unlock which paths',
        '**Covenant constraints** — required output structure per path',
        '**Timelock requirements** per function',
      ]} />
      <InfoBox>Powered by the same AST engine used by the TollGate — what you see is exactly what the compiler sees.</InfoBox>
    </>
  ),

  'flow-palette': (
    <>
      <PageTitle>Flow Palette</PageTitle>
      <Lead>Visual AST-based execution graph of a compiled contract showing every node: Function Entries, Conditional Branches, Covenant Checks, Validation Checkpoints.</Lead>
      <SectionH2>Use Cases</SectionH2>
      <BulletList items={[
        'Visually confirm all spending paths are **reachable**',
        'Identify **dead code** or unreachable branches',
        'Understand **covenant output structure** at a glance',
        'Share diagrams with auditors or stakeholders',
      ]} />
    </>
  ),

  'ex-escrow': (
    <>
      <PageTitle>Example: Escrow Contract</PageTitle>
      <SectionH2>Problem</SectionH2>
      <Para>A two-party escrow where funds are released when both parties agree, or returned to the sender after a timeout.</Para>
      <SectionH2>Intent</SectionH2>
      <CodeBlock lang="intent" code={`intent {\n  name: "Escrow"\n  rules: ["2-of-2 multisig release", "timeout release to sender after block 2000000"]\n}`} />
      <SectionH2>Generated Contract</SectionH2>
      <CodeBlock code={`pragma cashscript ^0.13.0;\n\ncontract Escrow(pubkey sender, pubkey recipient, int timeout) {\n    function release(sig senderSig, sig recipientSig) {\n        require(checkMultiSig([senderSig, recipientSig], [sender, recipient]));\n    }\n    function refund(sig senderSig) {\n        require(tx.time >= timeout);\n        require(checkSig(senderSig, sender));\n    }\n}`} />
      <SectionH2>TollGate Results</SectionH2>
      <Table head={['Check','Result','']} rows={[
        ['LNC Rules','20/20 passed','✅'],
        ['Anti-Patterns','0 detected','✅'],
        ['Total Score','98 / 100','**Grade: A**'],
      ]} />
    </>
  ),

  'ex-multisig': (
    <>
      <PageTitle>Example: Multisig Contract</PageTitle>
      <Para>A 2-of-3 multisig vault requiring any two of three authorized keys to spend funds.</Para>
      <CodeBlock code={`pragma cashscript ^0.13.0;\n\ncontract MultisigVault(pubkey pk1, pubkey pk2, pubkey pk3) {\n    function spend(sig s1, sig s2) {\n        require(checkMultiSig([s1, s2], [pk1, pk2, pk3]));\n    }\n}`} />
      <Table head={['Check','Result']} rows={[
        ['LNC-006 Sig Authorization','✅ checkMultiSig present'],
        ['APD-013 Bare Sig','✅ N/A — checkMultiSig context'],
        ['Total Score','100/100 — **Grade: A+**'],
      ]} />
    </>
  ),

  'ex-timelock': (
    <>
      <PageTitle>Example: Timelock Contract</PageTitle>
      <Para>Locks funds until a specific block height, then allows the recipient to claim them.</Para>
      <CodeBlock code={`pragma cashscript ^0.13.0;\n\ncontract TimeLockedEscrow(pubkey recipient, int unlockHeight) {\n    function claim(sig s) {\n        require(checkSig(s, recipient));\n        require(tx.time >= unlockHeight);\n    }\n}`} />
      <InfoBox>Note <Code>tx.time &gt;= unlockHeight</Code> uses <Code>&gt;=</Code> (block-inclusive), not <Code>&gt;</Code>. LNC-019 enforces this to prevent off-by-one timing errors.</InfoBox>
    </>
  ),

  'ex-covenant': (
    <>
      <PageTitle>Covenant Patterns</PageTitle>
      <Lead>Covenants constrain where funds can be sent, enabling stateful contracts on BCH through self-replication.</Lead>
      <CodeBlock code={`pragma cashscript ^0.13.0;\n\ncontract StatefulVault(pubkey owner) {\n    function withdraw(sig ownerSig, int amount) {\n        require(checkSig(ownerSig, owner));\n        require(tx.outputs.length == 2);\n        // Output 0: contract continues (self-anchor)\n        require(tx.outputs[0].lockingBytecode ==\n          tx.inputs[this.activeInputIndex].lockingBytecode);\n        require(tx.outputs[0].value >=\n          tx.inputs[this.activeInputIndex].value - amount - 1000);\n        // Output 1: withdrawal to owner\n        require(tx.outputs[1].value == amount);\n    }\n}`} />
      <SectionH2>Key Covenant Rules</SectionH2>
      <BulletList items={[
        'Always bind `tx.outputs.length` first — prevents APD-002 (Unchecked Output Count)',
        'Always check `lockingBytecode` before `value` — prevents APD-001 (Implicit Output Ordering)',
        'Use `this.activeInputIndex`, never hardcoded `tx.inputs[0]` — prevents APD-005',
      ]} />
    </>
  ),

  'security-model': (
    <>
      <PageTitle>Security Model</PageTitle>
      <Lead>NexOps reframes the trust question entirely: instead of "is the AI reliable?", we ask "does the deterministic report pass?"</Lead>
      <SectionH2>Auditor Independence</SectionH2>
      <CardGrid cards={[
        { title:'LLM Synthesizer', body:'temperature=0.7 — creative code generation. Isolated from auditor.', accent:'#818cf8' },
        { title:'LLM Auditor', body:'temperature=0.1 — conservative evaluation. No visibility into synthesis.', accent:'#fb923c' },
        { title:'Deterministic Layer', body:'Zero LLM involvement. Pure AST + rule matching. Fully reproducible.', accent:G },
      ]} />
      <SectionH2>The Negative Type System</SectionH2>
      <Para>Every Anti-Pattern detector is a theorem: <em style={{color:'#a1a1aa'}}>"If code contains pattern X, then exploit Y is possible."</em> The proof of security is the <strong style={{color:'#d4d4d8'}}>absence</strong> of any matching pattern X across the full registry.</Para>
      <SectionH2>Bias Prevention</SectionH2>
      <BulletList items={[
        '**Anchoring Bias**: Auditor independently assesses intent before reading code',
        '**Sycophancy Guard**: System prompt — "Assume the code is wrong until proven correct"',
        '**Code Fingerprinting**: SHA-256 proves audit ran on the code you submitted',
      ]} />
    </>
  ),

  'tollgate-checks': (
    <>
      <PageTitle>TollGate Checks — LNC Rule Registry</PageTitle>
      <Lead>20 Layered Nexus Compliance rules, each with a unique ID, severity, and machine-checkable condition.</Lead>
      <SectionH2>Syntax & Language (MANDATORY)</SectionH2>
      <Table head={['ID','Name','Severity']} rows={[
        ['LNC-001','No EVM Syntax','CRITICAL'],
        ['LNC-002','Valid Pragma','HIGH'],
        ['LNC-003','Boolean Semantics','MEDIUM'],
        ['LNC-004','No Compound Assignment','MEDIUM'],
        ['LNC-005','Valid Types Only','HIGH'],
      ]} />
      <SectionH2>Covenant & Output Anchoring (CRITICAL)</SectionH2>
      <Table head={['ID','Name','Severity']} rows={[
        ['LNC-009','Output Count Bound','CRITICAL'],
        ['LNC-010','Identity Anchor','CRITICAL'],
        ['LNC-011','Value Anchor','CRITICAL'],
        ['LNC-012','LockingBytecode Continuity','HIGH'],
        ['LNC-016','Division Safety','HIGH'],
        ['LNC-019','Timelock Operator','HIGH'],
      ]} />
      <SectionH2>Score Deduction Table</SectionH2>
      <Table head={['Severity','Score Deduction']} rows={[
        ['CRITICAL','-30 points'],
        ['HIGH','-10 points'],
        ['MEDIUM','-5 points'],
        ['LOW','-2 points'],
      ]} />
    </>
  ),

  'deterministic-verify': (
    <>
      <PageTitle>Deterministic Verification</PageTitle>
      <Lead>The scoring engine produces a reproducible, mathematical score. The 70/30 split is structural — not a weighted average.</Lead>
      <SectionH2>Score Formula</SectionH2>
      <CodeBlock lang="python" code={`# Deterministic component (0-70)\n# Start at 70, subtract per violation:\nScore_Det = max(0, 70 - sum(deductions))\nif not compilation_succeeded:\n    Score_Det = 0\n\n# Semantic component (0-30)\nScore_Cat = category_scores[semantic_category]  # 0-20\nScore_Biz = min(10, business_logic_score)        # 0-10\nScore_Sem = min(30, Score_Cat + Score_Biz)\nif semantic_category in ["funds_unspendable","exploit_pathway"]:\n    Score_Sem = 0\n\n# Total\nScore_Total = Score_Det + Score_Sem  # max 100`} />
      <SectionH2>Semantic Risk Categories</SectionH2>
      <Table head={['Category','Score','Description']} rows={[
        ['`none`','20/20','No structural flaws detected'],
        ['`minor_inefficiency`','15/20','Redundant checks, non-optimal resource use'],
        ['`logic_gap`','10/20','Edge case exists but is not a security failure'],
        ['`major_protocol_flaw`','5/20','Flaw causing incorrect behavior under specific conditions'],
        ['`funds_unspendable`','0/20','⛔ Funds enter but can never be retrieved'],
        ['`exploit_pathway`','0/20','⛔ Described attack path exists in logic'],
      ]} />
    </>
  ),

  'threat-model': (
    <>
      <PageTitle>Threat Model</PageTitle>
      <Lead>NexOps models 14 distinct attack categories against BCH smart contracts, each formalized as a theorem with an exploit vector and canonical fix.</Lead>
      <Table head={['APD','Attack','Severity','Exploit Summary']} rows={[
        ['APD-001','Implicit Output Ordering','CRITICAL','Attacker places payout at index 0 before contract continuation'],
        ['APD-002','Unchecked Output Count','CRITICAL','Extra outputs attached to drain unauthorized funds'],
        ['APD-003','Missing Value Anchor','CRITICAL','lockingBytecode checked but value unchecked → fund draining'],
        ['APD-004','Missing LockingBytecode Anchor','CRITICAL','Value checked but redirect address unverified'],
        ['APD-008','Solidity Keyword','CRITICAL','Invalid compilation masked by plausible-looking code'],
        ['APD-009','EVM State Model','CRITICAL','State stored in contract vars — not persisted between calls'],
        ['APD-010','Token Sum Not Preserved','CRITICAL','Token inflation via unbound output token amounts'],
        ['APD-005','Missing Input Index Anchor','HIGH','`tx.inputs[0]` wrong in multi-input context'],
        ['APD-006','Division By Zero','HIGH','User passes 0 as divisor → script bricks permanently'],
        ['APD-013','Bare Sig Without Auth','HIGH','Any valid signature spends regardless of context'],
      ]} />
    </>
  ),

  'intent-schema': (
    <>
      <PageTitle>Intent Schema Reference</PageTitle>
      <SectionH2>TypeScript Definition</SectionH2>
      <CodeBlock lang="typescript" code={`interface Intent {\n  name: string;          // PascalCase, 2-50 chars\n  network: "chipnet" | "mainnet";\n  parameters: {\n    [key: string]: "pubkey"|"int"|"bytes"|"bytes20"|"bytes32"|"sig"\n  };\n  rules: string[];       // Min 1 plain-language spending rule\n  metadata?: {\n    author?: string;\n    version?: string;\n  };\n}`} />
      <SectionH2>Validation Rules</SectionH2>
      <Table head={['Field','Rule']} rows={[
        ['`name`','Required. PascalCase. 2–50 characters.'],
        ['`network`','Required. `"chipnet"` for test, `"mainnet"` for production.'],
        ['`rules`','At least 1 rule required. Plain English preferred.'],
      ]} />
    </>
  ),

  'nexir-spec': (
    <>
      <PageTitle>NexIR Specification</PageTitle>
      <SectionH2>Constructor Parameter Roles</SectionH2>
      <Table head={['Role','Description','Types']} rows={[
        ['authorization','Signing key for a spending path','pubkey'],
        ['temporal_lower','Earliest valid block or time','int'],
        ['temporal_upper','Latest valid block or time','int'],
        ['value_reference','Amount in satoshis','int'],
        ['data_anchor','Hash or commitment value','bytes32, bytes20'],
      ]} />
      <SectionH2>Statefulness Values</SectionH2>
      <CardGrid cards={[
        { title:'STATELESS', body:'Simple signature-based spending. No covenant output propagation required. (HTLC, P2PKH)', accent:'#818cf8' },
        { title:'STATEFUL', body:'Covenant-based self-replication. Requires output_limit, self_anchor, value_anchor checks.', accent:G },
      ]} />
    </>
  ),

  'cli-commands': (
    <>
      <PageTitle>CLI Commands (coming soon)</PageTitle>
      <SectionH2>nexops compile</SectionH2>
      <CodeBlock lang="bash" code={`nexops compile <intent-file> [options]\n\nOptions:\n  --network, -n    chipnet | mainnet         [required]\n  --verbose, -v    Show full audit report\n  --output, -o     Write artifacts to directory\n  --max-retries    TollGate repair iterations [default: 3]\n\nExample:\n  nexops compile escrow.intent --network chipnet --verbose`} />
      <SectionH2>nexops verify</SectionH2>
      <CodeBlock lang="bash" code={`nexops verify <cashscript-file> --network chipnet\n\n# Run TollGate against an existing .cash file\nexops verify myvault.cash --network chipnet --verbose`} />
      <SectionH2>nexops deploy</SectionH2>
      <CodeBlock lang="bash" code={`nexops deploy <artifact-dir> [options]\n\nOptions:\n  --fund-from    WIF private key or wallet path\n  --amount       Satoshis to lock in contract\n\nExample:\n  nexops deploy ./artifacts/escrow --network chipnet --amount 100000`} />
    </>
  ),

  terminology: (
    <>
      <PageTitle>Protocol Terminology</PageTitle>
      <Table head={['Term','Definition']} rows={[
        ['**Intent**','Plain-language specification of a contract\'s desired behavior'],
        ['**NexIR**','Synthesis Intermediate Representation — structural JSON before logic injection'],
        ['**TollGate**','Phase 3 deterministic enforcement — non-AI, non-bypassable'],
        ['**LNC**','Layered Nexus Compliance — the 20-rule registry governing all contracts'],
        ['**APD**','Anti-Pattern Detector — one of 14 formalized vulnerability models'],
        ['**IQS**','Intent Quality Score — pre-synthesis quality rating of user input'],
        ['**Covenant**','Contract that constrains where funds can be sent, enabling state persistence'],
        ['**masterNFT**','Identity token for trustless inter-contract authentication'],
        ['**GSP**','Guarded Synthesis Pipeline — the four-phase generation process'],
        ['**DEL**','Deterministic Enforcement Layer — the security subsystem guaranteeing safety invariants'],
        ['**Chipnet**','BCH development testnet for all NexOps pre-production testing'],
        ['**P2SH32**','Pay-to-Script-Hash-32 — preferred contract address format (32-byte, collision-resistant)'],
      ]} />
    </>
  ),
};

// ─── Main component ──────────────────────────────────────────────────────────
export const Documentation: React.FC = () => {
  const { sectionId } = useParams<{ sectionId: string }>();
  const activeId = sectionId || 'introduction';

  useEffect(() => {
    // Scroll to top of the main scrollable pane
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [activeId]);

  return (
    <DocsLayout activeId={activeId}>
      <div style={{ paddingBottom: 32 }}>
        {sections[activeId] ?? sections.introduction}
      </div>
    </DocsLayout>
  );
};