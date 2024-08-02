import ActionLogService from '@base/services/actionlogger/actionlogService';
import { UserLogEntry } from '@base/services/actionlogger/state';
import { GNode, GraphService, NodeType, PartialEdge, UserNodeId } from '@base/services/graph';

export interface Snapshot {
    edges: PartialEdge[];
    nodes: GNode<NodeType>[];
    logs: UserLogEntry[];
}

export function makeUserSnapshot(
    graph: GraphService,
    logger: ActionLogService,
    id: UserNodeId,
    since: number,
    first: boolean
): Snapshot {
    const nodes = graph.getNodesSince('user', since).filter((u) => u.id !== id);
    const logs = logger.getActionLogTypeSince(since, 'engagement').filter((l) => (l.entry.value || 0) > 0);
    return { edges: [], nodes, logs: first ? logs : logs.filter((l) => l.user !== id) };
}
