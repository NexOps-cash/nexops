import Groq from "groq-sdk";
import { GenerationResponse, AuditReport, ProjectFile, BYOKSettings } from "../types";
import { ragEngine } from "./RagEngine";
import { websocketService } from "./websocketService";

// Initialize Groq SDK
const getGroqClient = (byok?: BYOKSettings) => {
    const apiKey = (byok?.provider === 'groq' && byok?.apiKey) ? byok.apiKey : process.env.GROQ_API_KEY;
    return new Groq({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });
};

const groq = getGroqClient();

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

export const generateSmartContract = async (prompt: string, byok?: BYOKSettings): Promise<GenerationResponse> => {
    const client = getGroqClient(byok);
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

    // Refusal Gate (Strict MCP Check)
    if (!websocketService.isConnected()) {
        return {
            code: "// Generation on Hold",
            explanation: "mcp is not yet hosted, generation is on hold now"
        };
    }

    try {
        const completion = await client.chat.completions.create({
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
    history: { role: 'user' | 'model', text: string }[],
    byok?: BYOKSettings
): Promise<{ response: string, fileUpdates?: { name: string, content: string }[] }> => {
    const client = getGroqClient(byok);
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

        const completion = await client.chat.completions.create({
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

        const result = JSON.parse(completion.choices[0]?.message?.content || '{}');

        // Strengthen Blockade: Allow file updates ONLY if MCP is connected
        if (result.fileUpdates && result.fileUpdates.length > 0 && !websocketService.isConnected()) {
            return {
                response: "mcp is not yet hosted, generation is on hold now. AI Chat can answer questions, but automated file updates are disabled until the external connection is active.",
                fileUpdates: []
            };
        }

        return result;
    } catch (error) {
        console.error("Assistant Error:", error);
        throw error;
    }
};

export const generateProjectScaffold = async (projectName: string, prompt: string): Promise<ProjectFile[]> => {
    // Static scaffolding - stop auto-generation
    return [
        {
            name: "Contract.cash",
            content: `pragma cashscript ^0.13.0;

/*
 * Project: ${projectName}
 * Status: Workspace Initialized
 * Instructions: ${prompt || 'Enter your logic here'}
 */

contract ${projectName.replace(/\s+/g, '') || 'MyContract'}() {
    function unlock() {
        require(true);
    }
}
`,
            language: 'cashscript'
        },
        {
            name: "README.md",
            content: `# ${projectName}

Initial workspace for your Bitcoin Cash smart contract.

## Usage
- Write your contract logic in \`Contract.cash\`
- Run Security Audit from the AI Console
- Use the 3-step guide to Build/Fund/Run
`,
            language: 'markdown'
        }
    ];
};

export const editSmartContract = async (code: string, instruction: string, useExternal: boolean = false, byok?: BYOKSettings): Promise<GenerationResponse> => {
    if (useExternal || websocketService.isConnected()) {
        try {
            const response = await fetch('http://localhost:3005/api/edit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_code: code,
                    instruction: instruction,
                    context: {
                        groq_key: byok?.provider === 'groq' ? byok.apiKey : '',
                        openrouter_key: byok?.provider === 'openrouter' ? byok.apiKey : '',
                        use_rag: false
                    }
                })
            });

            const data = await response.json();
            console.log("🛠️ External Edit Response:", data);
            if (data.success === false) {
                return {
                    code: code,
                    explanation: "🛡️ AI Edit failed safety constraints. Manual edit required."
                };
            }

            const scoreInfo = data.new_report ? ` New Security Score: ${data.new_report.score}` : '';
            return {
                code: data.edited_code || code,
                explanation: `✅ Edit Applied Successfully.${scoreInfo}`
            };
        } catch (error) {
            console.error("External Edit Error:", error);
            // If websocket is connected but HTTP fails, we still block internal fallback
            if (websocketService.isConnected()) {
                return {
                    code: code,
                    explanation: "❌ MCP Connection Error: Automated editing is unavailable."
                };
            }
        }
    }

    // BYOK Allowed
    return {
        code: code,
        explanation: "mcp is not yet hosted, generation is on hold now"
    };
};

export const fixSmartContract = async (code: string, instructions: string, useExternal: boolean = false, issue?: any, byok?: BYOKSettings): Promise<GenerationResponse> => {
    if (useExternal || websocketService.isConnected()) {
        try {
            const response = await fetch('http://localhost:3005/api/repair', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_code: code,
                    instruction: instructions,
                    issue: issue,
                    context: {
                        groq_key: byok?.provider === 'groq' ? byok.apiKey : '',
                        openrouter_key: byok?.provider === 'openrouter' ? byok.apiKey : '',
                        use_rag: false
                    }
                })
            });

            const data = await response.json();
            console.log("🔧 External Repair (Fix) Response:", data);
            if (data.success) {
                return {
                    code: data.fixed_code || code,
                    explanation: "✅ AI Fix Applied via External Engine."
                };
            }
        } catch (error) {
            console.error("External Fix Error:", error);
            if (websocketService.isConnected()) {
                return {
                    code: code,
                    explanation: "❌ MCP Connection Error: Automated fixes are unavailable."
                };
            }
        }
    }


    return {
        code: code,
        explanation: "mcp is not yet hosted, automated fixes are on hold now"
    };
};

export const auditSmartContract = async (code: string, useExternal: boolean = false, intent: string = '', effective_mode: string = '', byok?: BYOKSettings): Promise<AuditReport> => {
    if (useExternal) {
        try {
            const response = await fetch('http://localhost:3005/api/audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    ...(intent ? { intent } : {}),
                    ...(effective_mode ? { effective_mode } : {}),
                    context: {
                        groq_key: byok?.provider === 'groq' ? byok.apiKey : '',
                        openrouter_key: byok?.provider === 'openrouter' ? byok.apiKey : '',
                        use_rag: false // Disable internal RAG for auditing
                    }
                })
            });

            const data = await response.json();
            console.log("🛡️ External Audit Response:", data);

            return {
                score: data.total_score ?? data.score ?? 0,
                total_score: data.total_score,
                deterministic_score: data.deterministic_score,
                semantic_score: data.semantic_score,
                semantic_category: data.semantic_category,
                deployment_allowed: data.deployment_allowed,
                risk_level: data.risk_level,
                summary: `Security Audit Complete. Risk: ${data.risk_level}. Score: ${data.total_score}. Issues: ${data.issues?.length ?? 0}`,
                vulnerabilities: (data.issues ?? []).map((issue: any) => ({
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
        const client = getGroqClient(byok);
        const completion = await client.chat.completions.create({
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

export const explainSmartContract = async (code: string, byok?: BYOKSettings): Promise<ContractExplanation> => {
    const client = getGroqClient(byok);
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
        const completion = await client.chat.completions.create({
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
