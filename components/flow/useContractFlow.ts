import { useMemo } from 'react';
import { extractFlow } from './FlowExtractor';
import { FlowNode, FlowEdge, ExecutionStep } from './FlowTypes';

export function useContractFlow(artifact: any, sourceCode: string): { nodes: FlowNode[], edges: FlowEdge[], orderedSteps: ExecutionStep[] } {
    return useMemo(() => {
        return extractFlow(artifact, sourceCode);
    }, [artifact, sourceCode]);
}
