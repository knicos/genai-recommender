import { betaProbability, biasedUniqueSubset } from '@base/utils/subsets';
import { Recommendation } from '../recommenderTypes';
import { ContentNodeId, WeightedNode } from '@base/services/graph/graphTypes';
import { GraphService } from '@base/services/graph';
import { ContentService } from '@base/services/content';

export function getPopularCandidates(
    graph: GraphService,
    content: ContentService,
    nodes: Recommendation[],
    count: number
) {
    const allNodes = graph.getNodesByType('content');
    if (allNodes.length === 0) return;

    const maxEngagement = content.getMaxContentEngagement() || 1;
    const popular: WeightedNode<ContentNodeId>[] = allNodes.map((n) => ({
        id: n,
        weight: content.getContentStats(n).engagement / maxEngagement,
    }));
    popular.sort((a, b) => b.weight - a.weight);

    const now = Date.now();
    const randomNodes = biasedUniqueSubset(popular, count, (v) => v.weight);
    randomNodes.forEach((node) => {
        nodes.push({
            contentId: node.id,
            candidateOrigin: 'popular',
            popularityScore: node.weight,
            timestamp: now,
        });
    });
}

export function popularProbability(graph: GraphService, content: ContentService, id: ContentNodeId, count: number) {
    const allNodes = graph.getNodesByType('content');
    if (allNodes.length === 0) return 0;

    const maxEngagement = content.getMaxContentEngagement() || 1;
    const popular: WeightedNode<ContentNodeId>[] = allNodes.map((n) => ({
        id: n,
        weight: content.getContentStats(n).engagement / maxEngagement,
    }));
    popular.sort((a, b) => b.weight - a.weight);

    const probs = popular.map((r, ix) =>
        r.id === id ? 1 - Math.pow(1 - betaProbability(ix, popular.length), count) : 0
    );
    const p = probs.reduce((s, v) => s + v - s * v, 0);
    return p;
}
