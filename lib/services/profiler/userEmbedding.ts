import { normalise, weightedMeanEmbedding } from '@base/utils/embedding';
import { UserNodeId } from '../graph/graphTypes';
import { GraphService } from '../graph';
import { ContentService, WeightedLabel } from '../content';
import { ProfilingOptions } from './profilerTypes';

const MAX_ENGAGEMENTS = 50;
const MAX_TIME = 60 * 60 * 1000;

export function generateEmbedding(
    graph: GraphService,
    content: ContentService,
    id: UserNodeId,
    options?: ProfilingOptions
) {
    const engaged = graph
        .getRelated('engaged', id, {
            count: options?.historySize || MAX_ENGAGEMENTS,
            timeDecay: 0.2,
            period: options?.sessionDuration || MAX_TIME,
        })
        .filter((e) => e.weight > 0);
    const em = engaged.map((c) => {
        const meta = content.getContentMetadata(c.id);
        if (meta) return meta.embedding || [];
        else return [];
    });
    const w = engaged.map((content) => content.weight);
    return normalise(weightedMeanEmbedding(em, w));
}

export function generateLabelEmbedding(graph: GraphService, labels: WeightedLabel[]) {
    const tags = graph.getNodesByType('topic');
    const tagMap = new Map<string, number>();
    labels.forEach((l) => {
        tagMap.set(`topic:${l.label}`, l.weight);
    });
    return tags.map((t) => tagMap.get(t) || 0);
}
