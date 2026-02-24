import Groq from "groq-sdk";
import { GenerationResponse, AuditReport, ProjectFile } from "../types";
import { ragEngine } from "./RagEngine";

// Initialize Groq SDK
// Note: In Vite, we're relying on the process.envshim from vite.config.ts
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    dangerouslyAllowBrowser: true // Required for client-side usage
});

const MODEL_CODE = 'llama-3.3-70b-versatile';
const MODEL_AUDIT = 'llama-3.3-70b-versatile';

const GROQ_LIMITS = {
    code_generation: 1200,
    code_fix: 1200,
    chat: 1500,
    audit: 1600,
    scaffold: 1500
};

const TEMP_CODE = 0.15;
const TEMP_FIX = 0.0;

export const generateSmartContract = async (prompt: string): Promise<GenerationResponse> => {
    // 1. RAG Retrieval Step
    const context = ragEngine.retrieveContext(prompt);

    // 2. Refusal Gate
    if (!context) {
        return {
            code: "// Generation Refused: Insufficient Authoritative Context",
            explanation: "## 🛑 Generation Refused\n\nI could not find enough authoritative information in the Knowledge Base (Tier A/B) to safely generate this code. To prevent hallucinations and potential loss of funds, I have halted generation.\n\n**Please try:**\n- Clarifying your intent (e.g., 'create a covenant for...').\n- Checking if the topic is covered in the official CashScript documentation."
        };
    }

    const systemInstruction = `You are an expert Smart Contract Developer specializing in CashScript for Bitcoin Cash (BCH). 
  Generate secure, optimized smart contract code based on the user's request.
  
  CRITICAL SOURCE ADHERENCE:
  You have been provided with OFFICIAL context from the Knowledge Base (Tier A/B). 
  1. ONLY use syntax and patterns defined in the [SOURCE] blocks.
  2. STRICTLY follow 'NexKB/security_rules.json' if present in context.
  3. If generating a covenant, you MUST implement the '5-point validation' (lockingBytecode, tokenCategory, value, tokenAmount, nftCommitment).
  4. NEVER use EVM concepts (msg.sender, address, transfer, send, reentrancy).
  5. Cite the Used Sources in your explanation.

  CRITICAL OUTPUT RULES:
  1. Return ONLY the code in a JSON object.
  2. The 'code' property MUST be properly formatted with line breaks (\n) and indentation (4 spaces). 
  3. No conversational text or explanations.
  
  JSON SCHEMA:
  {
    "code": "full source code string...",
    "explanation": "" 
  }

  CRITICAL: YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. NO PREAMBLE. NO MARKDOWN CODE BLOCKS AROUND THE JSON.

  PROVIDED CONTEXT:
  ${context}`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
            ],
            model: MODEL_CODE,
            temperature: TEMP_CODE,
            max_tokens: GROQ_LIMITS.code_generation,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("No response from AI");

        return JSON.parse(text) as GenerationResponse;

    } catch (error) {
        console.error("Groq Generation Error:", error);
        throw error;
    }
};

export const chatWithAssistant = async (
    message: string,
    files: ProjectFile[],
    history: { role: 'user' | 'model', text: string }[]
): Promise<{ response: string, fileUpdates?: { name: string, content: string }[] }> => {
    // Basic Chat RAG Retrieval (Optional but helpful for Q&A)
    const ragContext = ragEngine.retrieveContext(message);
    const fileContext = files.map(f => `FILE: ${f.name}\nCONTENT:\n${f.content}`).join('\n\n---\n\n');

    const systemInstruction = `You are the NexusAI IDE Assistant, a world-class blockchain engineer.
  You have access to the current project files and a Knowledge Base.
  
  KNOWLEDGE BASE CONTEXT:
  ${ragContext || "No relevant KB articles found."}

  PROJECT CONTEXT:
  ${fileContext}
  
  RULES:
  1. If the user asks for code changes, provide the full updated content for the relevant files.
  2. Be concise but helpful. Use the KB context to answer technical questions accurately.
  3. Return your response in JSON format.
  
  RESPONSE SCHEMA:
  {
    "response": "A markdown string explaining what you did. DO NOT embed the JSON schema or 'fileUpdates' inside this string.",
    "fileUpdates": [
      { "name": "filename.cash", "content": "full updated content..." }
    ]
  }
  
  CRITICAL: RESPONSE MUST BE PURE JSON ONLY. NO PREAMBLE. NO EXPLANATION OUTSIDE THE JSON. NO MARKDOWN BACKTICKS AROUND THE JSON.`;

    try {
        // Convert history to Groq format
        const startHistory = history.map(h => ({
            role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: h.text
        }));

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                // @ts-ignore
                ...startHistory,
                { role: 'user', content: message }
            ],
            model: MODEL_CODE,
            max_tokens: GROQ_LIMITS.chat,
            response_format: { type: "json_object" }
        });

        return JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch (error) {
        console.error("Assistant Error:", error);
        throw error;
    }
};

export const generateProjectScaffold = async (name: string, description: string): Promise<ProjectFile[]> => {
    if (!process.env.GROQ_API_KEY) return [
        { name: 'Contract.cash', content: '// Groq API Key missing. Please configure.', language: 'cashscript' },
        { name: 'abi.json', content: '[]', language: 'json' },
        { name: 'README.md', content: `# ${name}\n\n${description}`, language: 'markdown' }
    ];

    const prompt = `Create a Web3 project structure for a Bitcoin Cash dApp named "${name}".
        Description: ${description}
    Language: CashScript(BCH)
    
    Return a JSON object containing the files. 
    1. Main contract file(Contract.cash).
    2. A dummy artifact.json
    3. A README.md
    
    Response Format: { "files": [{ "name": "...", "content": "...", "language": "..." }] }
    `;

    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: MODEL_CODE,
            max_tokens: GROQ_LIMITS.scaffold,
            response_format: { type: "json_object" }
        });

        const data = JSON.parse(completion.choices[0]?.message?.content || '{"files": []}');
        return data.files;

    } catch (e) {
        return [
            {
                name: 'MyContract.cash',
                content: 'contract MyContract() {\n    function spend() {\n        require(true);\n    }\n}',
                language: 'cashscript'
            },
            { name: 'artifact.json', content: '{\n  "contractName": "MyContract"\n}', language: 'json' },
            { name: 'README.md', content: `# ${name} \n\nGenerated by NexusAI via Groq`, language: 'markdown' }
        ];
    }
};

export const fixSmartContract = async (code: string, instructions: string, useExternal: boolean = false, issue?: any): Promise<GenerationResponse> => {
    if (useExternal) {
        try {
            const response = await fetch('http://localhost:3005/api/repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_code: code,
                    issue: {
                        severity: (issue as any)?.severity || 'HIGH',
                        line: (issue as any)?.line,
                        title: (issue as any)?.title || 'Manual Fix',
                        description: (issue as any)?.description || instructions,
                        recommendation: (issue as any)?.recommendation || instructions,
                        rule_id: (issue as any)?.rule_id,
                        can_fix: (issue as any)?.can_fix ?? true
                    },
                    context: {}
                })
            });

            const data = await response.json();
            console.log("🛠️ External Repair Response:", data);
            if (data.success === false) {
                // Return original code but signal failure in explanation
                return {
                    code: code,
                    explanation: "🛡️ AI Repair failed safety constraints. Manual fix required."
                };
            }

            return {
                code: data.corrected_code,
                explanation: `✅ Repair Successful. New Security Score: ${data.new_report.score}`
            };
        } catch (error) {
            console.error("External Repair Error:", error);
            throw error;
        }
    }

    // Retrieve context based on the code/instructions to help the fix
    const context = ragEngine.retrieveContext(instructions + "\n" + code.slice(0, 500));

    const systemInstruction = `You are a Senior Smart Contract Security Engineer. 
    Your task is to FIX the provided smart contract based on the vulnerability report and instructions.
    
    REFERENCE CONTEXT:
    ${context || "No specific context retrieved."}

    1. Apply fixes for the mentioned vulnerabilities.
    2. TARGETED FIXES ONLY: Return only the modified functions or blocks of code. Do not return the entire file.
    3. Add brief comments explaining the security fixes.
    4. RETURN FORMATTED CODE with proper newlines and indentation.
    
    Return JSON with the fixed code chunks and a summary of changes.
    Schema: { "code": "...", "explanation": "..." }
    
    CRITICAL: YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. NO PREAMBLE. NO MARKDOWN CODE BLOCKS AROUND THE JSON.`;

    try {
        const prompt = `ORIGINAL CODE: \n${code} \n\nFIX INSTRUCTIONS: \n${instructions} `;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: prompt }
            ],
            model: MODEL_CODE,
            temperature: TEMP_FIX,
            max_tokens: GROQ_LIMITS.code_fix,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("No response from AI");

        return JSON.parse(text) as GenerationResponse;

    } catch (error) {
        console.error("Groq Fix Error:", error);
        throw error;
    }
};

export const auditSmartContract = async (code: string, useExternal: boolean = false): Promise<AuditReport> => {
    if (useExternal) {
        try {
            const response = await fetch('http://localhost:3005/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    effective_mode: "",
                    context: {}
                })
            });

            const data = await response.json();
            console.log("🛡️ External Audit Response:", data);

            return {
                score: data.score,
                risk_level: data.risk_level,
                summary: `Security Audit Complete. Risk Level: ${data.risk_level}. Issues found: ${data.issues.length}`,
                vulnerabilities: data.issues.map((issue: any) => ({
                    severity: issue.severity,
                    line: issue.line,
                    title: issue.title,
                    description: issue.description,
                    recommendation: issue.recommendation,
                    rule_id: issue.rule_id,
                    can_fix: issue.can_fix
                })),
                timestamp: Date.now(),
                metadata: data.metadata,
                total_high: data.total_high,
                total_medium: data.total_medium,
                total_low: data.total_low
            };
        } catch (error) {
            console.error("External Audit Error:", error);
            throw error;
        }
    }

    // 1. Retrieve Security Context
    // We explicitly query for "security audit vulnerabilities" + snippets from the code
    const context = ragEngine.retrieveContext("security audit vulnerabilities common attacks covenent safety " + code.slice(0, 200));

    const systemInstruction = `You are an elite Smart Contract Security Auditor(NexusAI Auditor) for Bitcoin Cash(BCH).
  Analyze the provided CashScript code for security vulnerabilities.
  
  KNOWLEDGE BASE SECURITY GUIDELINES:
  ${context}

  PHASE 0: SYNTAX & VALIDITY GATE[CRITICAL]
  Before auditing logic, you MUST validate that the code is valid CashScript.
  REJECT the contract immediately(Score: 0, Severity: CRITICAL) if it contains:
        1. 'address' type(CashScript uses 'bytes20' or 'pubkeyhash').
  2. Mutable Global State(e.g. 'int x = 0;' outside functions, or 'x += 5').State is UTXO - based.
  3. 'tx.inputs[...]' inspection(Illegal.Use introspection 'tx.inputs[i].value' etc only in supported versions, typically use 'tx.outputs').
  4. 'msg.sender'(Does not exist.Use 'pubkey' argument + 'checkSig').
  5. 'transfer()' or 'send()'(Does not exist.Use Covenants via 'tx.outputs').
  6. 'block.timestamp'(Use 'tx.time').

  If any of these exist, STOP auditing logic.Return a "Compiler/Syntax Error" vulnerability.

        PHASE 1: LOGIC AUDIT(Only if Syntax passes)
    CRITICAL: REJECT EVM / SOLIDITY CONCEPTS
  You are auditing BITCOIN CASH(UTXO Model), NOT Ethereum.
  1. NO "Reentrancy": It does not exist on BCH.
  2. NO "Unilateral Unlock": If a path requires checkSig(A) && checkSig(B), neither can unlock alone.
  3. NO "tx.inputs.length" magic number warnings: This is valid in CashScript for covenants.
  4. NO "Constructor" or "Initializer" vulnerabilities: Contracts are stateless.
  
  Strictly output JSON. 
  Assign a security score from 0(Critical Fail) to 100(Perfect).
  List vulnerabilities with severity: HIGH, MEDIUM, LOW, or INFO.
  
  Common Real BCH Vulnerabilities:
    - SEC-001: Missing 5 - point covenant validation(CRITICAL)
        - SEC-002: Missing output count limit(CRITICAL)
            - SEC-006: Missing this.activeInputIndex validation(CRITICAL)
                - SEC-013: Missing tokenCategory validation on BCH - only outputs(HIGH)
                    - SEC-012: Integer overflow in counters without guards(HIGH)
                        - Dust limits(outputs < 546 satoshis)
  
  Provide a specific fix suggestion for each issue.
  
  JSON Schema:
        {
            "score": 85,
                "summary": "...",
                    "vulnerabilities": [
                        {
                            "severity": "HIGH",
                            "title": "...",
                            "description": "...",
                            "recommendation": "...",
                            "line": 10
                        }
                    ]
        }
  
  CRITICAL: YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. NO PREAMBLE. NO MARKDOWN CODE BLOCKS AROUND THE JSON.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `Audit this contract: \n\n${code} ` }
            ],
            model: MODEL_AUDIT,
            max_tokens: GROQ_LIMITS.audit,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("No response from AI");

        const data = JSON.parse(text);

        // Robust formatting with defaults
        return {
            score: data.score ?? 0,
            risk_level: data.risk_level || 'MEDIUM',
            summary: data.summary || "Security audit completed with generic summary.",
            vulnerabilities: (data.vulnerabilities || []).map((v: any) => ({
                severity: v.severity || 'LOW',
                title: v.title || 'Security Warning',
                description: v.description || 'No description provided.',
                recommendation: v.recommendation || 'No recommendation provided.',
                line: v.line || 0
            })),
            timestamp: Date.now(),
            metadata: data.metadata || {
                compile_success: true,
                dsl_passed: true,
                structural_score: 80,
                contract_hash: "0x..."
            }
        } as AuditReport;

    } catch (error) {
        console.error("Groq Audit Error:", error);
        throw error;
    }
};

export interface ContractExplanation {
    summary: string;
    roles: { name: string; description: string }[];
    functions: { name: string; description: string; conditions: string[]; result: string }[];
    risks: { level: 'LOW' | 'MEDIUM' | 'HIGH'; description: string }[];
}

export const explainSmartContract = async (code: string): Promise<ContractExplanation> => {
    const systemInstruction = `You are a CashScript static analysis assistant.
Analyze the compiled contract and return structured JSON.

Return strictly in this format:
{
  "summary": "...",
  "roles": [
    { "name": "...", "description": "..." }
  ],
  "functions": [
    {
      "name": "...",
      "description": "...",
      "conditions": ["..."],
      "result": "..."
    }
  ],
  "risks": [
    {
      "level": "LOW",
      "description": "..."
    }
  ]
}

Keep explanations concise.
Do not produce paragraphs.
Do not include filler text.

CRITICAL: YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT. NO PREAMBLE.`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: `Explain this contract:\n\n${code}` }
            ],
            model: MODEL_AUDIT,
            max_tokens: 1500,
            temperature: 0.1,
            response_format: { type: "json_object" }
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) throw new Error("No response from AI");

        return JSON.parse(text) as ContractExplanation;
    } catch (error) {
        console.error("Groq Explain Error:", error);
        throw error;
    }
};
