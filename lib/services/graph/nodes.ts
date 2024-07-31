import { emitNodeTypeEvent } from './events';
import { GNode, NodeID, NodeType } from './graphTypes';
import { edgeSrcIndex, edgeStore, edgeTypeSrcIndex, nodeStore, nodeTypeIndex } from './state';
import { v4 as uuidv4 } from 'uuid';

export function removeNode<T extends NodeType>(id: NodeID<T>) {
    // Remove all edges first.
    const edges = edgeSrcIndex.get(id);
    if (edges) {
        edges.forEach((edge) => {
            const id = `${edge.destination}:${edge.type}:${edge.source}`;
            const srctypeid = `${edge.type}:${edge.source}`;
            edgeStore.delete(id);
            edgeSrcIndex.delete(edge.source);
            edgeTypeSrcIndex.delete(srctypeid);
        });
    }

    const node = nodeStore.get(id);
    if (node) {
        const typeIndex = nodeTypeIndex.get(node.type);
        nodeTypeIndex.set(
            node.type,
            (typeIndex || []).filter((f) => f.id !== id)
        );
        nodeStore.delete(id);

        emitNodeTypeEvent(node.type, id);
    }
}

export function touchNode(id: NodeID) {
    const existing = nodeStore.get(id);
    if (existing) {
        existing.timestamp = Date.now();
        // emitNodeTypeEvent(existing.type, id);
    }
}

export function updateNode(id: NodeID, data: unknown) {
    const existing = nodeStore.get(id);
    if (existing) {
        //const old = existing.data;
        existing.data = data;
        existing.timestamp = Date.now();
        //if (old !== data) {
        emitNodeTypeEvent(existing.type, id);
        //}
    }
}

export function addNode<T extends NodeType>(type: T, id?: NodeID<T>, data?: unknown): NodeID<T> {
    const nid = id ? id : (`${type}:${uuidv4()}` as NodeID<T>);
    if (nodeStore.has(nid)) throw new Error('id_exists');
    const node = { type, id: nid, data, timestamp: Date.now() };
    nodeStore.set(nid, node);
    if (!nodeTypeIndex.has(type)) {
        nodeTypeIndex.set(type, []);
    }
    const typeArray = nodeTypeIndex.get(type);
    if (typeArray) typeArray.push(node);

    emitNodeTypeEvent(type, nid);

    return nid;
}

export function addNodeIfNotExists<T extends NodeType>(type: T, id: NodeID<T>, data?: unknown): NodeID<T> | undefined {
    const nid = id;
    if (nodeStore.has(nid)) {
        if (data) {
            const n = nodeStore.get(nid);
            if (n && n.data !== data) {
                updateNode(nid, data);
            }
        }
        return;
    }
    const node = { type, id: nid, data, timestamp: Date.now() };
    nodeStore.set(nid, node);
    if (!nodeTypeIndex.has(type)) {
        nodeTypeIndex.set(type, []);
    }
    const typeArray = nodeTypeIndex.get(type);
    if (typeArray) typeArray.push(node);

    emitNodeTypeEvent(type, nid);

    return nid;
}

export function addNodes(nodes: GNode<NodeType>[]) {
    nodes.forEach((node) => {
        addNodeIfNotExists(node.type, node.id, node.data);
    });
}

export function getNodeType(id: string): NodeType | null {
    const n = nodeStore.get(id);
    return n ? n.type : null;
}

export function hasNode(id: NodeID) {
    return nodeStore.has(id);
}

export function getNodeData<T = unknown>(id: NodeID): T | undefined {
    const n = nodeStore.get(id);
    return n?.data as T;
}

export function getNodesByType<T extends NodeType>(type: T): NodeID<T>[] {
    const nt = nodeTypeIndex.get(type);
    return (nt ? nt.map((n) => n.id) : []) as NodeID<T>[];
}

export function getNodesSince<T extends NodeType>(type: T, time: number): GNode<T>[] {
    return ((nodeTypeIndex.get(type) || []) as GNode<T>[]).filter((n) => n.timestamp > time);
}

const globalNode: NodeID<'special'> = 'special:root';
addNodeIfNotExists('special', 'special:root');

export function getRootNode() {
    return globalNode;
}
