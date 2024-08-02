import { uniformUniqueSubset } from '@base/utils/subsets';
import { Recommendation } from '../recommenderTypes';
import { GraphService } from '@base/services/graph';

export function fillWithRandom(graph: GraphService, nodes: Recommendation[], count: number) {
    const allNodes = graph.getNodesByType('content');
    if (allNodes.length === 0) return;

    const now = Date.now();
    const randomNodes = uniformUniqueSubset(allNodes, count, (v) => v);
    randomNodes.forEach((node) => {
        nodes.push({
            contentId: node,
            candidateOrigin: 'random',
            timestamp: now,
        });
    });
}

export function randomCandidateProbability(graph: GraphService, count: number) {
    const allNodes = graph.getNodesByType('content');
    return 1 - Math.pow(1 - 1 / allNodes.length, count);
}
