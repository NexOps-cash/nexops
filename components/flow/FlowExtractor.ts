import { FlowNode, FlowEdge, ExecutionStep } from './FlowTypes';

export function extractFlow(artifact: any, sourceCode: string): { nodes: FlowNode[], edges: FlowEdge[], orderedSteps: ExecutionStep[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const orderedSteps: ExecutionStep[] = [];

    let stepOrder = 1;

    if (!artifact) {
        return { nodes, edges, orderedSteps };
    }

    // 1. Add contract root node
    const contractId = 'contract';
    const contractName = artifact.contractName || 'Contract';

    nodes.push({ id: contractId, type: 'contract', label: contractName });
    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: 0, type: 'contract', label: contractName });

    // Map functions from sourceCode
    const functionBodies: Record<string, string> = {};
    if (sourceCode) {
        // Simple extraction of function bodies
        const parts = sourceCode.split(/\bfunction\s+/);
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            const nameMatch = part.match(/^(\w+)/);
            if (nameMatch) {
                const name = nameMatch[1];
                functionBodies[name] = part;
            }
        }
    }

    // 2. Loop through functions in ABI
    if (artifact.abi && Array.isArray(artifact.abi)) {
        artifact.abi.forEach((fn: any, index: number) => {
            const funcId = `function-${index}`;
            const funcLabel = fn.name || `Constructor/Fallback`;
            let currentDepth = 1;

            nodes.push({ id: funcId, type: 'function', label: funcLabel });
            orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth, type: 'function', label: funcLabel });
            edges.push({ id: `edge-c-${funcId}`, source: contractId, target: funcId });

            const body = functionBodies[fn.name] || '';

            let currentParent = funcId;
            let lastConditionId: string | null = null;
            let nodeCounter = 0;
            let hasTerminal = false;

            const stmtRegex = /(if\s*\([\s\S]*?\)\s*\{)|(else\s*if\s*\([\s\S]*?\)\s*\{)|(else\s*\{)|(require\s*\([\s\S]*?\)\s*;)/g;
            let match;

            while ((match = stmtRegex.exec(body)) !== null) {
                const text = match[0];
                let type, label;

                if (text.startsWith('if')) {
                    const expr = text.replace(/^if\s*\(/, '').replace(/\)\s*\{$/, '').trim();
                    type = 'condition';
                    label = expr;
                } else if (text.startsWith('else if')) {
                    const expr = text.replace(/^else\s*if\s*\(/, '').replace(/\)\s*\{$/, '').trim();
                    type = 'elseif';
                    label = expr;
                } else if (text.startsWith('else')) {
                    type = 'else';
                    label = 'Fallback Path';
                } else if (text.startsWith('require')) {
                    const expr = text.replace(/^require\s*\(/, '').replace(/\)\s*;$/, '').trim();
                    if (expr === 'true') {
                        type = 'success';
                        label = 'Success';
                    } else if (expr === 'false') {
                        type = 'failure';
                        label = 'Failure';
                    } else {
                        type = 'validation';
                        label = `Validation: ${expr}`;
                    }
                }

                if (type === 'condition') {
                    currentDepth++;
                    const condId = `cond-${index}-${nodeCounter++}`;
                    nodes.push({ id: condId, type: 'condition', label });
                    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth, type: 'condition', label });

                    edges.push({ id: `edge-${currentParent}-${condId}`, source: currentParent, target: condId });

                    lastConditionId = condId;
                    currentParent = condId;
                }
                else if (type === 'elseif' && lastConditionId) {
                    const condId = `cond-${index}-${nodeCounter++}`;
                    nodes.push({ id: condId, type: 'condition', label });
                    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth, type: 'condition', label });

                    edges.push({ id: `edge-${lastConditionId}-${condId}`, source: lastConditionId, target: condId });

                    lastConditionId = condId;
                    currentParent = condId;
                }
                else if (type === 'else' && lastConditionId) {
                    const condId = `cond-${index}-${nodeCounter++}`;
                    nodes.push({ id: condId, type: 'condition', label });
                    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth, type: 'condition', label });

                    edges.push({ id: `edge-${lastConditionId}-${condId}`, source: lastConditionId, target: condId });

                    lastConditionId = condId;
                    currentParent = condId;
                }
                else if (type === 'success' || type === 'failure' || type === 'validation') {
                    const termId = `term-${index}-${nodeCounter++}`;
                    nodes.push({ id: termId, type: type as FlowNodeType, label });
                    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth + 1, type: type as FlowNodeType, label });

                    edges.push({ id: `edge-${currentParent}-${termId}`, source: currentParent, target: termId });
                    hasTerminal = true;
                }
            }

            // If no terminal was explicitly hit for the entire function
            if (!hasTerminal && nodes.filter(n => n.id.startsWith(`cond-${index}`)).length === 0) {
                const termId = `res-${index}-default`;
                nodes.push({ id: termId, type: 'success', label: 'Success' });
                orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, depth: currentDepth + 1, type: 'success', label: 'Success' });
                edges.push({ id: `edge-${currentParent}-${termId}`, source: currentParent, target: termId });
            }
        });
    }

    return { nodes, edges, orderedSteps };
}
