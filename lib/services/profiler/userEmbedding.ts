import { normalise, weightedMeanEmbedding } from '@base/utils/embedding';
import { UserNodeId } from '../graph/graphTypes';
import { GraphService } from '../graph';
import { ContentService } from '../content';

const MAX_ENGAGEMENTS = 50;
const MAX_TIME = 60 * 60 * 1000;

export function generateEmbedding(graph: GraphService, content: ContentService, id: UserNodeId) {
    const engaged = graph
        .getRelated('engaged', id, { count: MAX_ENGAGEMENTS, timeDecay: 0.2, period: MAX_TIME })
        .filter((e) => e.weight > 0);
    const em = engaged.map((c) => {
        const meta = content.getContentMetadata(c.id);
        if (meta) return meta.embedding || [];
        else return [];
    });
    const w = engaged.map((content) => content.weight);
    return normalise(weightedMeanEmbedding(em, w));
}
