import { FlowNode, FlowEdge, ExecutionStep } from './FlowTypes';

export function extractFlowFromArtifact(artifact: any): { nodes: FlowNode[], edges: FlowEdge[], orderedSteps: ExecutionStep[] } {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const orderedSteps: ExecutionStep[] = [];

    let stepOrder = 0;

    if (!artifact) {
        return { nodes, edges, orderedSteps };
    }

    // 1. Add contract root node
    const contractId = 'contract';
    const contractName = artifact.contractName || 'Contract';

    nodes.push({ id: contractId, type: 'contract', label: contractName });
    orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, type: 'contract', label: contractName });

    // 2. Loop through functions in ABI
    if (artifact.abi && Array.isArray(artifact.abi)) {
        artifact.abi.forEach((fn: any, index: number) => {
            const funcId = `function-${index}`;
            const resultId = `result-${index}`;
            const funcLabel = fn.name || `Constructor/Fallback`;

            // Function Node
            nodes.push({ id: funcId, type: 'function', label: funcLabel });
            orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, type: 'function', label: funcLabel });

            // Result Node
            nodes.push({ id: resultId, type: 'result', label: 'Valid Spend Path Available' });
            orderedSteps.push({ id: `step-${stepOrder}`, order: stepOrder++, type: 'result', label: 'Valid Spend Path Available' });

            // Connect Contract -> Function
            edges.push({ id: `edge-c-${funcId}`, source: contractId, target: funcId });
            // Connect Function -> Result
            edges.push({ id: `edge-${funcId}-${resultId}`, source: funcId, target: resultId });
        });
    }

    return { nodes, edges, orderedSteps };
}
