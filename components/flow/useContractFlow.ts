import { useMemo } from 'react';
import { extractFlowFromArtifact } from './FlowExtractor';
import { FlowNode, FlowEdge, ExecutionStep } from './FlowTypes';

export function useContractFlow(artifact: any): { nodes: FlowNode[], edges: FlowEdge[], orderedSteps: ExecutionStep[] } {
    return useMemo(() => {
        return extractFlowFromArtifact(artifact);
    }, [artifact]);
}
