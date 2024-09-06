import { UserNodeId } from '../graph/graphTypes';
import { Recommendation, Scores, ScoringOptions } from './recommenderTypes';
import { calculateAffinities, calculateAffinityScores } from './scoring/affinity';
import { calculateEmbeddingScore } from './scoring/embeddings';
import { calculateCoengagementScore } from './scoring/coengaged';
import { getLastSeenTime } from './scoring/seen';
import { GraphService } from '../graph';
import { ContentService } from '../content';
import { UserNodeData } from '../profiler';
import { getLastEngagedTime } from './scoring/engaged';

export function makeFeatures(
    graph: GraphService,
    content: ContentService,
    userId: UserNodeId,
    candidates: Recommendation[],
    profile: UserNodeData,
    options?: ScoringOptions
): Scores[] {
    const preferences = calculateAffinities(graph, profile);

    return candidates.map((c) => {
        const tasteSimilarityScore = options?.noTasteScore
            ? undefined
            : calculateEmbeddingScore(content, profile, c.contentId);
        const {
            viewingPreferenceScore,
            commentingPreferenceScore,
            sharingPreferenceScore,
            reactionPreferenceScore,
            followingPreferenceScore,
        } = calculateAffinityScores(graph, preferences, c.contentId, options);

        const coengagementScore = options?.noCoengagementScore
            ? undefined
            : calculateCoengagementScore(graph, userId, c.contentId);

        const lastSeenTime = options?.noLastSeenScore ? undefined : getLastSeenTime(graph, userId, c.contentId);
        const lastEngaged = getLastEngagedTime(graph, userId, c.contentId);

        const popScore = options?.noPopularity
            ? 0
            : (content.getContentStats(c.contentId)?.engagement || 0) / (content.getMaxContentEngagement() || 0.01);

        // userTasteSimilarity
        // userEngagementsSimilarity
        // coengagementScore
        // bestTopicAffinity
        // lastSeenTime (negative)
        // priorEngagements

        return {
            taste: tasteSimilarityScore,
            sharing: sharingPreferenceScore,
            commenting: commentingPreferenceScore,
            following: followingPreferenceScore,
            reaction: reactionPreferenceScore,
            viewing: viewingPreferenceScore,
            random: 0,
            coengagement: coengagementScore,
            lastSeen: lastSeenTime,
            popularity: popScore,
            lastEngaged,
        };
    });
}

export function makeFeatureVectors(
    graph: GraphService,
    content: ContentService,
    userId: UserNodeId,
    candidates: Recommendation[],
    profile: UserNodeData,
    options?: ScoringOptions
): number[][] {
    const features = makeFeatures(graph, content, userId, candidates, profile, options);
    return features.map((i) => Object.values(i));
}
