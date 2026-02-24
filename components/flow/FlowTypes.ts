export type FlowNodeType =
    | "contract"
    | "function"
    | "condition"
    | "success"
    | "failure"
    | "validation";

export interface FlowNode {
    id: string;
    type: FlowNodeType;
    label: string;
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
    label?: string;
}

export interface ExecutionStep {
    id: string;
    order: number;
    depth: number;
    type: FlowNodeType;
    label: string;
}
