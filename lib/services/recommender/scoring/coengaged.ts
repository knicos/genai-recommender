import { GraphService } from '@base/services/graph';
import { ContentNodeId, UserNodeId } from '@base/services/graph/graphTypes';

const COENGAGEMENT_MAX = 4;

export function calculateCoengagementScore(graph: GraphService, userId: UserNodeId, contentId: ContentNodeId) {
    // Get all coengagements for content
    const coengagements = graph.getRelated('coengaged', contentId, { count: 30 });

    // Check if the user has engaged with it
    let sum = 0;
    coengagements.forEach((e) => {
        const engaged = graph.getEdgeWeights('engaged', userId, e.id)[0] || 0;
        sum += engaged;
    });

    return Math.min(1, sum / COENGAGEMENT_MAX);
}
