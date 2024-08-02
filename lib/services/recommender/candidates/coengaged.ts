import { Recommendation } from '../recommenderTypes';
import { calculateCount } from './common';
import { betaProbability, biasedUniqueSubset } from '@base/utils/subsets';
import { ContentNodeId } from '@base/services/graph/graphTypes';
import { GraphService } from '@base/services/graph';
import { UserNodeData } from '@base/services/profiler/profilerTypes';

export function generateCoengaged(graph: GraphService, profile: UserNodeData, nodes: Recommendation[], count: number) {
    const engaged = profile.affinities.contents.contents;
    const high = engaged[0]?.weight || 0;
    const low = engaged[engaged.length - 1]?.weight || 0;

    engaged.forEach((e) => {
        const c = calculateCount(high, low, e.weight, count);
        // TODO: Consider using a popularity weighted edge here.
        const related = graph.getRelated('coengaged', e.id);
        const result = biasedUniqueSubset(related, c, (v) => v.id);
        result.forEach((tr) =>
            nodes.push({
                contentId: tr.id,
                candidateOrigin: 'coengagement',
                timestamp: Date.now(),
                engagedItem: e.id,
                engagedItemScore: e.weight,
                coengagementScore: tr.weight,
            })
        );
    });
}

export function coengagedProbability(
    graph: GraphService,
    profile: UserNodeData,
    count: number,
    id: ContentNodeId
): number {
    const engaged = profile.affinities.contents.contents;
    //const high = engaged[0]?.weight || 0;
    //const low = engaged[engaged.length - 1]?.weight || 0;

    let sumP = 0;

    engaged.forEach((e) => {
        //const c = calculateCount(high, low, e.weight, count);
        // TODO: Consider using a popularity weighted edge here.
        const related = graph.getRelated('coengaged', e.id);
        const ix = related.findIndex((v) => v.id === id);
        const p = ix >= 0 ? 1 - Math.pow(1 - betaProbability(ix, related.length), count) : 0;
        sumP = sumP + p - sumP * p;
    });

    return sumP;
}
