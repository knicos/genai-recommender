import { biasedUniqueSubset } from '@base/utils/subsets';
import ServiceBroker from '../broker';
import { ContentService } from '../content';
import { GraphService, UserNodeId } from '../graph';
import { ProfilerService } from '../profiler';
import { generateCandidates } from './candidates';
import { RecommendationOptions, ScoredRecommendation } from './recommenderTypes';
import { scoreCandidates } from './scoring';

const CANDIDATE_FACTOR = 10;

export default class RecommenderService {
    private broker: ServiceBroker;
    private graph: GraphService;
    private content: ContentService;
    private profiler: ProfilerService;
    private store = new Map<UserNodeId, ScoredRecommendation[]>();

    constructor(broker: ServiceBroker, graph: GraphService, content: ContentService, profiler: ProfilerService) {
        this.broker = broker;
        this.graph = graph;
        this.content = content;
        this.profiler = profiler;
    }

    public generateNewRecommendations(id: UserNodeId, count: number, options: RecommendationOptions, events = true) {
        const profile = this.profiler.getUserProfile(id);
        const candidates = generateCandidates(
            this.graph,
            this.content,
            this.profiler,
            profile,
            count * CANDIDATE_FACTOR,
            options
        );
        const scored = scoreCandidates(this.graph, this.content, id, candidates, profile, options);

        const old = this.store.get(id) || [];

        if (options?.selection === 'rank') {
            const subset = scored.slice(0, count);
            this.store.set(id, [...subset, ...old]);
            if (events) {
                this.broker.emit(`recom-${id}`, subset);
            }
        } else {
            const subset = biasedUniqueSubset(scored, count, (v) => v.contentId);
            subset.sort((a, b) => b.score - a.score);
            subset.forEach((s, ix) => {
                s.diversity = Math.abs(ix - s.rank) / scored.length;
            });

            this.store.set(id, [...subset, ...old]);
            if (events) {
                this.broker.emit(`recom-${id}`, subset);
            }
        }
    }

    public getRecommendations(id: UserNodeId, count: number, options: RecommendationOptions): ScoredRecommendation[] {
        const results = this.store.get(id) || [];
        if (results.length < count) {
            this.generateNewRecommendations(id, count, options, false);
            const results2 = this.store.get(id) || [];
            return results2.slice(0, count);
        } else {
            return results.slice(0, count);
        }
    }

    public appendRecommendations(id: UserNodeId, recommendations: ScoredRecommendation[]) {
        const old = this.store.get(id) || [];
        this.store.set(id, [...recommendations, ...old]);
        this.broker.emit(`recom-${id}`, recommendations);
    }

    public removeRecommendations(id: UserNodeId) {
        this.store.delete(id);
    }
}
