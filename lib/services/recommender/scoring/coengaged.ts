import { getEdgeWeights } from '@base/services/graph/edges';
import { ContentNodeId, UserNodeId } from '@base/services/graph/graphTypes';
import { getRelated } from '@base/services/graph/query';

const COENGAGEMENT_MAX = 4;

export function calculateCoengagementScore(userId: UserNodeId, contentId: ContentNodeId) {
    // Get all coengagements for content
    const coengagements = getRelated('coengaged', contentId, { count: 30 });

    // Check if the user has engaged with it
    let sum = 0;
    coengagements.forEach((e) => {
        const engaged = getEdgeWeights('engaged', userId, e.id)[0] || 0;
        sum += engaged;
    });

    return Math.min(1, sum / COENGAGEMENT_MAX);
}
