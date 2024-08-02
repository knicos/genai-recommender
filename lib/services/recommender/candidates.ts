import { CandidateOptions, Recommendation } from './recommenderTypes';
import { fillWithRandom, randomCandidateProbability } from './candidates/random';
import { generateSimilarUsers, similarUserProbability } from './candidates/similarUsers';
import { coengagedProbability, generateCoengaged } from './candidates/coengaged';
import { generateTasteBatch, tasteCandidateProbability } from './candidates/taste';
import { getPopularCandidates, popularProbability } from './candidates/popular';
import { ContentNodeId } from '../graph/graphTypes';
import { ProfilerService, UserNodeData } from '../profiler';
import { GraphService } from '../graph';
import { ContentService } from '../content';

function _generateCandidates(
    graph: GraphService,
    content: ContentService,
    profiler: ProfilerService,
    profile: UserNodeData,
    count: number,
    options: CandidateOptions
) {
    const nodes: Recommendation[] = [];

    const sumCounts = options.taste + options.coengaged + options.similarUsers + options.popular + options.random;
    const factor = 1 / sumCounts;

    if (count * options.taste * factor >= 1) generateTasteBatch(graph, profile, nodes, count * options.taste * factor);
    if (count * options.coengaged * factor >= 1)
        generateCoengaged(graph, profile, nodes, count * options.coengaged * factor);
    if (count * options.similarUsers * factor >= 1)
        generateSimilarUsers(profiler, profile, nodes, count * options.similarUsers * factor);
    if (count * options.popular * factor >= 1)
        getPopularCandidates(graph, content, nodes, count * options.popular * factor);
    if (count * options.random * factor >= 1) fillWithRandom(graph, nodes, count * options.random * factor);

    return nodes;
}

export function candidateProbabilities(
    graph: GraphService,
    content: ContentService,
    profiler: ProfilerService,
    profile: UserNodeData,
    count: number,
    options: CandidateOptions,
    id: ContentNodeId
): number {
    const sumCounts = options.taste + options.coengaged + options.similarUsers + options.popular + options.random;
    const factor = 1 / sumCounts;

    const probs = [
        count * options.taste * factor >= 1
            ? tasteCandidateProbability(graph, profile, count * options.taste * factor, id)
            : 0,
        count * options.coengaged * factor >= 1
            ? coengagedProbability(graph, profile, count * options.coengaged * factor, id)
            : 0,
        count * options.random * factor >= 1 ? randomCandidateProbability(graph, count * options.random * factor) : 0,
        count * options.similarUsers * factor >= 1
            ? similarUserProbability(profiler, profile, count * options.similarUsers * factor, id)
            : 0,
        count * options.popular * factor >= 1
            ? popularProbability(graph, content, id, count * options.popular * factor)
            : 0,
    ];

    return probs.reduce((s, v) => s + v - s * v, 0);
}

export function generateCandidates(
    graph: GraphService,
    content: ContentService,
    profiler: ProfilerService,
    profile: UserNodeData,
    count: number,
    options: CandidateOptions
): Recommendation[] {
    const selected = new Map<string, Recommendation>();

    let maxLoop = 2;
    while (selected.size < count && maxLoop-- > 0) {
        const nodes = _generateCandidates(graph, content, profiler, profile, count, options);

        for (let i = 0; i < nodes.length; ++i) {
            if (!selected.has(nodes[i].contentId)) {
                selected.set(nodes[i].contentId, nodes[i]);
            }
        }
    }

    // Still less than expected, so do some random
    if (selected.size < count) {
        const nodes = _generateCandidates(graph, content, profiler, profile, count, {
            taste: 0,
            coengaged: 0,
            similarUsers: 0,
            popular: 0,
            random: 2,
        });

        for (let i = 0; i < nodes.length; ++i) {
            if (!selected.has(nodes[i].contentId)) {
                selected.set(nodes[i].contentId, nodes[i]);
            }
        }
    }

    return Array.from(selected).map((s) => s[1]);
}
