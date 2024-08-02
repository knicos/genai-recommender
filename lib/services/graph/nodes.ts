import { NodeID, NodeType } from './graphTypes';
import GraphState from './state';
import { v4 as uuidv4 } from 'uuid';

export function removeNode<T extends NodeType>(state: GraphState, id: NodeID<T>) {
    // Remove all edges first.
    const edges = state.edgeSrcIndex.get(id);
    if (edges) {
        edges.forEach((edge) => {
            const id = `${edge.destination}:${edge.type}:${edge.source}`;
            const srctypeid = `${edge.type}:${edge.source}`;
            state.edgeStore.delete(id);
            state.edgeSrcIndex.delete(edge.source);
            state.edgeTypeSrcIndex.delete(srctypeid);
        });
    }

    const node = state.nodeStore.get(id);
    if (node) {
        const typeIndex = state.nodeTypeIndex.get(node.type);
        state.nodeTypeIndex.set(
            node.type,
            (typeIndex || []).filter((f) => f.id !== id)
        );
        state.nodeStore.delete(id);
    }
}

export function touchNode(state: GraphState, id: NodeID) {
    const existing = state.nodeStore.get(id);
    if (existing) {
        existing.timestamp = Date.now();
        // emitNodeTypeEvent(existing.type, id);
    }
}

export function updateNode(state: GraphState, id: NodeID, data: unknown) {
    const existing = state.nodeStore.get(id);
    if (existing) {
        //const old = existing.data;
        existing.data = data;
        existing.timestamp = Date.now();
    }
}

export function addNode<T extends NodeType>(state: GraphState, type: T, id?: NodeID<T>, data?: unknown): NodeID<T> {
    const nid = id ? id : (`${type}:${uuidv4()}` as NodeID<T>);
    if (state.nodeStore.has(nid)) throw new Error('id_exists');
    const node = { type, id: nid, data, timestamp: Date.now() };
    state.nodeStore.set(nid, node);
    if (!state.nodeTypeIndex.has(type)) {
        state.nodeTypeIndex.set(type, []);
    }
    const typeArray = state.nodeTypeIndex.get(type);
    if (typeArray) typeArray.push(node);

    return nid;
}

export function addNodeIfNotExists<T extends NodeType>(
    state: GraphState,
    type: T,
    id: NodeID<T>,
    data?: unknown
): NodeID<T> | undefined {
    const nid = id;
    if (state.nodeStore.has(nid)) {
        if (data) {
            const n = state.nodeStore.get(nid);
            if (n && n.data !== data) {
                updateNode(state, nid, data);
            }
        }
        return;
    }
    const node = { type, id: nid, data, timestamp: Date.now() };
    state.nodeStore.set(nid, node);
    if (!state.nodeTypeIndex.has(type)) {
        state.nodeTypeIndex.set(type, []);
    }
    const typeArray = state.nodeTypeIndex.get(type);
    if (typeArray) typeArray.push(node);

    //emitNodeTypeEvent(type, nid);

    return nid;
}

/*const globalNode: NodeID<'special'> = 'special:root';
addNodeIfNotExists('special', 'special:root');

export function getRootNode() {
    return globalNode;
}*/
