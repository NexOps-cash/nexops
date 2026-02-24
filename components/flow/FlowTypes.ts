export type FlowNodeType =
    | "contract"
    | "function"
    | "result";

export interface FlowNode {
    id: string;
    type: FlowNodeType;
    label: string;
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
}

export interface ExecutionStep {
    id: string;
    order: number;
    type: FlowNodeType;
    label: string;
}
