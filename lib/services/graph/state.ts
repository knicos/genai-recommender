import { NodeType, Edge, GNode, NodeID } from './graphTypes';

export default class GraphState {
    public nodeStore = new Map<string, GNode<NodeType>>();
    public nodeTypeIndex = new Map<NodeType, GNode<NodeType>[]>();
    public edgeStore = new Map<string, Edge<NodeID<NodeType>, NodeID<NodeType>>>();
    public edgeSrcIndex = new Map<string, Edge<NodeID<NodeType>, NodeID<NodeType>>[]>();
    public edgeTypeSrcIndex = new Map<string, Edge<NodeID<NodeType>, NodeID<NodeType>>[]>();

    public reset() {
        this.nodeStore.clear();
        this.nodeTypeIndex.clear();
        this.edgeStore.clear();
        this.edgeSrcIndex.clear();
        this.edgeTypeSrcIndex.clear();
    }
}

export function dump(graph: GraphState) {
    return {
        nodes: Array.from(graph.nodeStore.values()),
        edges: Array.from(graph.edgeStore.values()),
    };
}

export function dumpNodes(graph: GraphState) {
    return Array.from(graph.nodeStore.values());
}

export function dumpJSON(graph: GraphState) {
    return JSON.stringify(dump(graph), undefined, 4);
}

export type GraphExport = ReturnType<typeof dump>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _global = (window /* browser */ || global) /* node */ as any;
_global.dumpGraph = dumpJSON;
