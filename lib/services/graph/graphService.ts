import { NodeType, NodeID, EdgeType, SourceFor, DestinationFor, Edge, GNode, WeightedNode } from './graphTypes';
import GraphState from './state';
import { addEdge, addEdges, addOrAccumulateEdge, getEdge, getEdges, getEdgesOfType, getEdgeWeights } from './edges';
import { addNode, addNodeIfNotExists, removeNode, touchNode, updateNode } from './nodes';
import { getRelated, QueryOptions } from './query';
import ServiceBroker from '../broker';

export default class GraphService {
    private state = new GraphState();
    private broker: ServiceBroker;

    constructor(broker: ServiceBroker) {
        this.broker = broker;
    }

    public reset() {
        this.state.reset();
    }

    public addEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
        type: T,
        src: S,
        dest: D,
        weight?: number,
        timestamp?: number
    ): string | null {
        const e = addEdge(this.state, type, src, dest, weight, timestamp);
        this.broker.emit(`nodeedgetype-${src}-${type}`);
        this.broker.emit(`edgetype-${type}`, src);
        return e;
    }

    public addEdges(edges: Edge<NodeID>[]) {
        addEdges(this.state, edges);
        edges.forEach((edge) => {
            this.broker.emit(`nodeedgetype-${edge.source}-${edge.type}`);
            this.broker.emit(`edgetype-${edge.type}`, edge.source);
        });
    }

    public addOrAccumulateEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
        type: T,
        src: S,
        dest: D,
        weight: number,
        timestamp?: number
    ) {
        addOrAccumulateEdge(this.state, type, src, dest, weight, timestamp);
        this.broker.emit(`nodeedgetype-${src}-${type}`);
        this.broker.emit(`edgetype-${type}`, src);
    }

    public getEdgeWeights<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
        type: T,
        src: S,
        dest?: D | D[]
    ): number[] {
        return getEdgeWeights(this.state, type, src, dest);
    }

    public getEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
        type: T,
        src: S,
        dest: D
    ): Edge<S, D> | undefined {
        return getEdge(this.state, type, src, dest);
    }

    public getEdges<T extends NodeID<NodeType>>(node: T | T[], count?: number): Edge<T, NodeID<NodeType>>[] {
        return getEdges(this.state, node, count);
    }

    public getEdgesOfType<T extends EdgeType, N extends SourceFor<T>, R = Edge<N, DestinationFor<T, N>>>(
        type: T,
        node: N | N[],
        count?: number
    ): R[] {
        return getEdgesOfType(this.state, type, node, count);
    }

    public removeNode<T extends NodeType>(id: NodeID<T>) {
        const node = this.state.nodeStore.get(id);
        removeNode(this.state, id);
        if (node) {
            this.broker.emit(`nodetype-${node.type}`, id);
            this.broker.emit(`node-${id}`);
        }
    }

    public touchNode(id: NodeID) {
        touchNode(this.state, id);
    }

    public updateNode(id: NodeID, data: unknown) {
        const existing = this.state.nodeStore.get(id);
        updateNode(this.state, id, data);
        if (existing) {
            this.broker.emit(`nodetype-${existing.type}`, id);
            this.broker.emit(`node-${id}`);
        }
    }

    public addNode<T extends NodeType>(type: T, id?: NodeID<T>, data?: unknown): NodeID<T> {
        const nid = addNode(this.state, type, id, data);
        this.broker.emit(`nodetype-${type}`, nid);
        this.broker.emit(`node-${nid}`);
        return nid;
    }

    public hasNode(id: NodeID): boolean {
        return this.state.nodeStore.has(id);
    }

    public addNodeIfNotExists<T extends NodeType>(type: T, id: NodeID<T>, data?: unknown): NodeID<T> | undefined {
        const nid = addNodeIfNotExists(this.state, type, id, data);
        if ((!nid && data) || nid) {
            this.broker.emit(`nodetype-${type}`, nid || id);
            this.broker.emit(`node-${nid || id}`);
        }
        return nid;
    }

    public addNodes(nodes: GNode<NodeType>[]) {
        nodes.forEach((node) => {
            this.addNodeIfNotExists(node.type, node.id, node.data);
        });
    }

    public getNodeType(id: string): NodeType | null {
        const n = this.state.nodeStore.get(id);
        return n ? n.type : null;
    }

    public getNodeData<T = unknown>(id: NodeID): T | undefined {
        const n = this.state.nodeStore.get(id);
        return n?.data as T;
    }

    public getNodesByType<T extends NodeType>(type: T): NodeID<T>[] {
        const nt = this.state.nodeTypeIndex.get(type);
        return (nt ? nt.map((n) => n.id) : []) as NodeID<T>[];
    }

    public getNodesSince<T extends NodeType>(type: T, time: number): GNode<T>[] {
        return ((this.state.nodeTypeIndex.get(type) || []) as GNode<T>[]).filter((n) => n.timestamp > time);
    }

    public getRelated<T extends EdgeType, N extends SourceFor<T>, R extends DestinationFor<T, N>>(
        type: T,
        node: N | N[],
        options?: QueryOptions<N, R>
    ): WeightedNode<R>[] {
        const edges = this.getEdgesOfType<T, N, Edge<N, R>>(type, node);
        return getRelated(edges, options);
    }
}
