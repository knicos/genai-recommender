import { normalise } from '@base/main';
import { GraphService } from '../graph';

export function engagementEmbedding(graph: GraphService) {
    const content = graph.getNodesByType('content');
    const users = graph.getNodesByType('user');
    const engagements = content.map((c) => normalise(users.map((u) => graph.getEdgeWeights('engaged', u, c)[0] || 0)));
    return engagements;
}
