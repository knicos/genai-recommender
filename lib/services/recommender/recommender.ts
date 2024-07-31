import { RecommendationOptions, ScoredRecommendation } from './recommenderTypes';
import { generateCandidates } from './candidates';
import { scoreCandidates } from './scoring';
import { UserNodeId } from '../graph/graphTypes';
import { getUserProfile } from '../profiler/profiler';
import { emitRecommendationEvent } from './events';
import { biasedUniqueSubset } from '@base/utils/subsets';

const store = new Map<UserNodeId, ScoredRecommendation[]>();

const CANDIDATE_FACTOR = 10;

export function generateNewRecommendations(
    id: UserNodeId,
    count: number,
    options: RecommendationOptions,
    events = true
) {
    const profile = getUserProfile(id);
    const candidates = generateCandidates(profile, count * CANDIDATE_FACTOR, options);
    const scored = scoreCandidates(id, candidates, profile, options);

    const old = store.get(id) || [];

    if (options?.selection === 'rank') {
        const subset = scored.slice(0, count);
        store.set(id, [...subset, ...old]);
        if (events) emitRecommendationEvent(id, subset);
    } else {
        const subset = biasedUniqueSubset(scored, count, (v) => v.contentId);
        subset.sort((a, b) => b.score - a.score);
        subset.forEach((s, ix) => {
            s.diversity = Math.abs(ix - s.rank) / scored.length;
        });

        store.set(id, [...subset, ...old]);
        if (events) emitRecommendationEvent(id, subset);
    }
}

export function getRecommendations(
    id: UserNodeId,
    count: number,
    options: RecommendationOptions
): ScoredRecommendation[] {
    const results = store.get(id) || [];
    if (results.length < count) {
        generateNewRecommendations(id, count, options, false);
        const results2 = store.get(id) || [];
        return results2.slice(0, count);
    } else {
        return results.slice(0, count);
    }
}

export function appendRecommendations(id: UserNodeId, recommendations: ScoredRecommendation[]) {
    const old = store.get(id) || [];
    store.set(id, [...recommendations, ...old]);
    emitRecommendationEvent(id, recommendations);
}

export function removeRecommendations(id: UserNodeId) {
    store.delete(id);
}
