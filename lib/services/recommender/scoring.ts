import { makeFeatures } from './features';
import { Recommendation, ScoredRecommendation, Scores, ScoringOptions } from './recommenderTypes';
import { UserNodeId } from '../graph/graphTypes';
import { beta } from 'jstat';
import { UserNodeData } from '../profiler';
import { GraphService } from '../graph';
import { ContentService } from '../content';

const RAND_COMPONENT = 0.001;

function normalise(v: number[]) {
    const sum = v.reduce((s, i) => s + i, 0);
    return sum > 0 ? v.map((i) => i / sum) : v.slice();
}

function calculateSignificance(items: ScoredRecommendation[]) {
    if (items.length === 0) return [];
    const keys = Object.keys(items[0].scores) as (keyof Scores)[];

    items.forEach((item, i) => {
        const significance: Scores = {};
        let maxSig = -Infinity;

        keys.forEach((key) => {
            for (let k = i + 1; k < items.length; ++k) {
                const diff = (item.scores[key] || 0) - (items[k].scores[key] || 0);
                const s = (significance[key] || 0) + diff;
                significance[key] = s;
                maxSig = Math.max(maxSig, s);
            }
        });

        keys.forEach((key) => {
            const s = significance[key] || 0;
            significance[key] = maxSig > 0 ? Math.max(0, s) / maxSig : 0;
        });

        item.significance = significance;
    });
}

function optionsWeights(options?: ScoringOptions) {
    const weights: Scores = {
        taste: options?.noTasteScore ? 0 : 1,
        coengagement: options?.noCoengagementScore ? 0 : 1,
        viewing: options?.noViewingScore ? 0 : 1,
        sharing: options?.noSharingScore ? 0 : 1,
        commenting: options?.noCommentingScore ? 0 : 1,
        popularity: options?.noPopularity ? 0 : 1,
        following: options?.noFollowingScore ? 0 : 1,
        reaction: options?.noReactionScore ? 0 : 1,
        lastSeen: options?.noLastSeenScore ? 0 : 1,
        random: 0.0,
    };
    return weights;
}

function calculateScores(
    graph: GraphService,
    content: ContentService,
    userId: UserNodeId,
    candidates: Recommendation[],
    profile: UserNodeData,
    options?: ScoringOptions
) {
    // Could use Tensorflow here?
    const features = makeFeatures(graph, content, userId, candidates, profile, options);
    const keys = (features.length > 0 ? Object.keys(features[0]) : []) as (keyof Scores)[];
    const featureVectors = features.map((i) => Object.values(i));
    const enabledWeights = optionsWeights(options);
    const weights = normalise(
        keys.map((k) => {
            const ew = enabledWeights[k];
            const fw = profile.featureWeights[k];
            return (ew === undefined ? 1 : ew) * (fw === undefined ? 1 : fw);
        })
    );
    const scores = featureVectors.map((c) => c.map((f, ix) => (f || 0) * (weights[ix] || 0)));
    const namedScores = scores.map((s) => s.reduce((r, v, ix) => ({ ...r, [keys[ix]]: v }), {}));

    const results: ScoredRecommendation[] = candidates.map((c, ix) => ({
        ...c,
        features: features[ix],
        scores: namedScores[ix],
        significance: {},
        score: scores[ix].reduce((s, v) => s + v, 0),
        rank: 0,
        diversity: 0,
    }));

    return results;
}

export function scoreCandidates(
    graph: GraphService,
    content: ContentService,
    userId: UserNodeId,
    candidates: Recommendation[],
    profile: UserNodeData,
    options?: ScoringOptions
): ScoredRecommendation[] {
    const results = calculateScores(graph, content, userId, candidates, profile, options);

    // Inject some tiny randomness here to prevent identical scores
    results.forEach((r) => {
        r.score = (1 - RAND_COMPONENT) * r.score + RAND_COMPONENT * Math.random();
    });

    results.sort((a, b) => b.score - a.score);
    results.forEach((r, ix) => {
        r.rank = ix;
    });

    if (!options?.excludeSignificance) {
        calculateSignificance(results);
    }

    return results;
}

const ALPHA = 0.5;
const BETA = 1;

export function scoringProbability(
    graph: GraphService,
    content: ContentService,
    userId: UserNodeId,
    candidates: Recommendation[],
    profile: UserNodeData,
    count: number,
    options?: ScoringOptions
): ScoredRecommendation[] {
    const results = calculateScores(graph, content, userId, candidates, profile, options);

    results.sort((a, b) => b.score - a.score);

    const rankTally = new Map<number, number>();

    for (let i = 0; i < results.length; ++i) {
        const r = results[i];
        if (i === 0 || r.score < results[i - 1].score) {
            r.rank = i;
        } else {
            r.rank = results[i - 1].rank;
            rankTally.set(r.rank, (rankTally.get(r.rank) || 1) + 1);
        }
    }

    if (options?.selection === 'distribution') {
        results.forEach((r) => {
            const tally = rankTally.get(r.rank) || 1;
            r.rank = (r.rank - 0.5) / results.length;
            const p = 1 - beta.cdf(r.rank, ALPHA, BETA);
            r.probability = (r.candidateProbability || 0) * p * (1 / tally);
        });
    } else {
        const accumProb = results.map((a) => {
            return 1 - (a.candidateProbability || 0) * (1 / count);
        });
        for (let i = 1; i < accumProb.length; ++i) {
            const p = accumProb[i];
            const p1 = accumProb[i - 1];
            if (results[i].rank !== results[i - 1].rank) {
                accumProb[i] = p1 * p;
            } else {
                accumProb[i] = p1;
            }
        }

        results.forEach((r, i) => {
            const tally = rankTally.get(r.rank) || 1;
            const sp1 = i >= 1 ? accumProb[i - 1] : 1;
            const p = (r.candidateProbability || 0) * sp1 * (1 / tally);
            r.probability = 1 - Math.pow(1 - p, count);
            r.rank = r.rank / results.length;
        });
    }

    // Normalise the probabilities
    const sumP = results.reduce((s, r) => s + (r.probability || 0), 0);
    results.forEach((r) => {
        r.probability = (r.probability || 0) / sumP;
    });

    return results;
}
