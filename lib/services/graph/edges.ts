import { DestinationFor, Edge, EdgeType, NodeID, NodeType, SourceFor } from './graphTypes';
import GraphState from './state';

const ACCUMEDGES = new Set<EdgeType>(['coengaged', 'last_engaged', 'seen', 'engaged']);

export function addEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
    state: GraphState,
    type: T,
    src: S,
    dest: D,
    weight?: number,
    timestamp?: number
): string | null {
    if (!state.nodeStore.has(src) || !state.nodeStore.has(dest)) return null;

    const id = `${dest}:${type}:${src}`;
    const oldEdge = state.edgeStore.get(id);

    if (oldEdge) {
        oldEdge.weight = weight || 0;
        oldEdge.timestamp = timestamp || Date.now();
        return id;
    }

    const edge = { type, source: src, destination: dest, weight: weight || 0, metadata: {}, timestamp: 0 };
    edge.timestamp = timestamp || Date.now();
    state.edgeStore.set(id, edge);

    if (!state.edgeSrcIndex.has(src)) state.edgeSrcIndex.set(src, []);
    state.edgeSrcIndex.get(src)?.push(edge);

    const typesrckey = `${type}:${src}`;
    if (!state.edgeTypeSrcIndex.has(typesrckey)) state.edgeTypeSrcIndex.set(typesrckey, []);
    state.edgeTypeSrcIndex.get(typesrckey)?.push(edge);
    return id;
}

export function addEdges(state: GraphState, edges: Edge<NodeID>[]) {
    edges.forEach((edge) => {
        const id = `${edge.destination}:${edge.type}:${edge.source}`;

        // Some edge types will accumulate on load.
        if (ACCUMEDGES.has(edge.type) && state.edgeStore.has(id)) {
            const e = state.edgeStore.get(id);
            if (e) {
                edge.weight += e.weight;
            }
        }

        state.edgeStore.set(id, edge);
        const oldSrcIndex = state.edgeSrcIndex.get(edge.source);
        if (oldSrcIndex) {
            oldSrcIndex.push(edge);
        } else {
            state.edgeSrcIndex.set(edge.source, [edge]);
        }

        const typesrckey = `${edge.type}:${edge.source}`;
        const oldTypeIndex = state.edgeTypeSrcIndex.get(typesrckey);
        if (oldTypeIndex) {
            oldTypeIndex.push(edge);
        } else {
            state.edgeTypeSrcIndex.set(typesrckey, [edge]);
        }
    });
}

export function addOrAccumulateEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
    state: GraphState,
    type: T,
    src: S,
    dest: D,
    weight: number,
    timestamp?: number
) {
    const id = `${dest}:${type}:${src}`;
    const oldEdge = state.edgeStore.get(id);
    const edge = oldEdge || { type, source: src, destination: dest, weight: 0, metadata: {}, timestamp: 0 };
    edge.timestamp = timestamp || Date.now();
    edge.weight += weight;

    if (!oldEdge) {
        state.edgeStore.set(id, edge);
        if (!state.edgeSrcIndex.has(src)) state.edgeSrcIndex.set(src, []);
        state.edgeSrcIndex.get(src)?.push(edge);

        const typesrckey = `${type}:${src}`;
        if (!state.edgeTypeSrcIndex.has(typesrckey)) state.edgeTypeSrcIndex.set(typesrckey, []);
        state.edgeTypeSrcIndex.get(typesrckey)?.push(edge);
    }
}

export function getEdgeWeights<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
    state: GraphState,
    type: T,
    src: S,
    dest?: D | D[]
): number[] {
    if (!dest) {
        return getEdgesOfType(state, type, src).map((e) => e.weight);
    } else if (Array.isArray(dest)) {
        return dest.map((d) => {
            const id = `${d}:${type}:${src}`;
            const edge = state.edgeStore.get(id);
            return edge ? edge.weight : 0;
        });
    } else {
        const id = `${dest}:${type}:${src}`;
        const edge = state.edgeStore.get(id);
        return [edge ? edge.weight : 0];
    }
}

export function getEdge<T extends EdgeType, S extends SourceFor<T>, D extends DestinationFor<T, S>>(
    state: GraphState,
    type: T,
    src: S,
    dest: D
): Edge<S, D> | undefined {
    const id = `${dest}:${type}:${src}`;
    return state.edgeStore.get(id) as Edge<S, D> | undefined;
}

export function getEdges<T extends NodeID<NodeType>>(
    state: GraphState,
    node: T | T[],
    count?: number
): Edge<T, NodeID<NodeType>>[] {
    if (Array.isArray(node)) {
        const resultSet: Edge<T, NodeID<NodeType>>[] = [];
        for (let i = 0; i < node.length; ++i) {
            const n = node[i];
            const candidates = state.edgeSrcIndex.get(n);
            if (candidates) {
                resultSet.push(...(candidates as Edge<T, NodeID<NodeType>>[]));
            }
            if (count && resultSet.length > count) break;
        }
        return count ? resultSet.slice(0, count) : resultSet;
    } else {
        const results = (state.edgeSrcIndex.get(node) || []) as Edge<T, NodeID<NodeType>>[];
        return count ? results.slice(0, count) : results;
    }
}

export function getEdgesOfType<T extends EdgeType, N extends SourceFor<T>, R = Edge<N, DestinationFor<T, N>>>(
    state: GraphState,
    type: T,
    node: N | N[],
    count?: number
): R[] {
    if (Array.isArray(node)) {
        const resultSet: R[] = [];
        for (let i = 0; i < node.length; ++i) {
            const n = node[i];

            if (Array.isArray(type)) {
                for (let j = 0; j < type.length; ++j) {
                    const t = type[j];
                    const candidates = state.edgeTypeSrcIndex.get(`${t}:${n}`);
                    if (candidates) {
                        resultSet.push(...(candidates as R[]));
                    }
                    if (count && resultSet.length > count) break;
                }
            } else {
                const candidates = state.edgeTypeSrcIndex.get(`${type}:${n}`);
                if (candidates) {
                    resultSet.push(...(candidates as R[]));
                }
            }
            if (count && resultSet.length > count) break;
        }
        return count ? resultSet.slice(0, count) : resultSet;
    } else {
        if (Array.isArray(type)) {
            const resultSet: R[] = [];
            for (let i = 0; i < type.length; ++i) {
                const t = type[i];
                const candidates = state.edgeTypeSrcIndex.get(`${t}:${node}`);
                if (candidates) {
                    resultSet.push(...(candidates as R[]));
                }
                if (count && resultSet.length > count) break;
            }
            return count ? resultSet.slice(0, count) : resultSet;
        } else {
            const results = (state.edgeTypeSrcIndex.get(`${type}:${node}`) || []) as R[];
            return count ? results.slice(0, count) : results;
        }
    }
}
