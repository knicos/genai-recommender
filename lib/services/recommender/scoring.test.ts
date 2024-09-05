import { beforeEach, describe, it } from 'vitest';
import { scoreCandidates, scoringProbability } from './scoring';
import { Recommendation } from './recommenderTypes';
import { normalise } from '@base/utils/embedding';
import ServiceBroker from '../broker';
import { GraphService } from '../graph';
import { ContentService } from '../content';
import { ProfilerService } from '../profiler';

describe('Scoring.scoringProbability()', () => {
    let broker = new ServiceBroker();
    let graph = new GraphService(broker);
    let content = new ContentService(broker, graph);
    let profiler = new ProfilerService(broker, graph, content);

    beforeEach(() => {
        broker = new ServiceBroker();
        graph = new GraphService(broker);
        content = new ContentService(broker, graph);
        profiler = new ProfilerService(broker, graph, content);
    });

    it('calculates a random rank probability correctly', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates: Recommendation[] = [
            {
                contentId: 'content:1',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:2',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:3',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:4',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
        ];
        const scored = scoringProbability(graph, content, 'user:xyz', candidates, profile, 1, {
            noTasteScore: true,
            noPopularity: true,
            noViewingScore: true,
            noCoengagementScore: true,
            noFollowingScore: true,
            noCommentingScore: true,
            noReactionScore: true,
            noSharingScore: true,
            selection: 'rank',
        });

        expect(scored).toHaveLength(4);
        expect(scored[1].probability).toBe(scored[2].probability);
    });

    it('calculates a random distribution probability correctly', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates: Recommendation[] = [
            {
                contentId: 'content:1',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:2',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:3',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
            {
                contentId: 'content:4',
                candidateOrigin: 'random',
                timestamp: Date.now(),
                candidateProbability: 0.1,
            },
        ];
        const scored = scoringProbability(graph, content, 'user:xyz', candidates, profile, 1, {
            noTasteScore: true,
            noPopularity: true,
            noViewingScore: true,
            noCoengagementScore: true,
            noFollowingScore: true,
            noCommentingScore: true,
            noReactionScore: true,
            noSharingScore: true,
            selection: 'distribution',
        });

        console.log(scored);

        expect(scored).toHaveLength(4);
        expect(scored[1].probability).toBe(scored[2].probability);
    });
});

describe('Scoring.scoreCandidates()', () => {
    let broker = new ServiceBroker();
    let graph = new GraphService(broker);
    let content = new ContentService(broker, graph);
    let profiler = new ProfilerService(broker, graph, content);

    beforeEach(() => {
        broker = new ServiceBroker();
        graph = new GraphService(broker);
        content = new ContentService(broker, graph);
        profiler = new ProfilerService(broker, graph, content);
    });

    it('calculates a taste score if no taste available', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates: Recommendation[] = [
            {
                contentId: 'content:xyz',
                candidateOrigin: 'topic_affinity',
                timestamp: Date.now(),
            },
        ];
        const scored = scoreCandidates(graph, content, 'user:xyz', candidates, profile, {
            noLastSeenScore: true,
            noLastEngagedScore: true,
        });
        expect(scored).toHaveLength(1);
        expect(scored[0].score).toBeLessThanOrEqual(0.15);
    });

    it('calculates a taste score correctly', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        content.addContent('xxx', { labels: [], id: 'xyz2', embedding: normalise([0.9, 0.1]) });
        profile.embeddings.taste = normalise([0.8, 0.2]);
        const candidates: Recommendation[] = [
            {
                contentId: 'content:xyz2',
                candidateOrigin: 'topic_affinity',
                timestamp: Date.now(),
            },
        ];
        const scored = scoreCandidates(graph, content, 'user:xyz', candidates, profile, {
            noLastEngagedScore: true,
            noLastSeenScore: true,
        });
        expect(scored).toHaveLength(1);
        expect(scored[0].score).toBeGreaterThan(0.0);
        expect(scored[0].features.taste).toBeGreaterThan(0.01);
    });

    it('calculates prior engagement penalty', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        content.addContent('xxx', { labels: [], id: 'xyz2', embedding: normalise([0.9, 0.1]) });
        content.broker.emit('activity-engagement', 'user:xyz', 'content:xyz2', 1, Date.now() - 10000);
        const candidates: Recommendation[] = [
            {
                contentId: 'content:xyz2',
                candidateOrigin: 'topic_affinity',
                timestamp: Date.now(),
            },
        ];
        const scored = scoreCandidates(graph, content, 'user:xyz', candidates, profile, { noLastSeenScore: true });
        expect(scored).toHaveLength(1);
        expect(scored[0].features.lastEngaged).toBeLessThan(0.1);
    });

    it('calculates a popularity score correctly', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        content.addContent('xxx', { labels: [], id: 'xyz2', embedding: [0.9, 0.1] });
        content.addContent('xxx', { labels: [], id: 'xyz', embedding: [0.9, 0.1] });
        profile.embeddings.taste = [0.8, 0.2];
        const candidates: Recommendation[] = [
            {
                contentId: 'content:xyz2',
                candidateOrigin: 'topic_affinity',
                timestamp: Date.now(),
            },
        ];

        content.addContentEngagement('content:xyz2', 0.8);
        content.addContentEngagement('content:xyz', 2);

        const scored = scoreCandidates(graph, content, 'user:xyz', candidates, profile);
        expect(scored).toHaveLength(1);
        expect(scored[0].score).toBeGreaterThan(0.0);
        expect(scored[0].features.popularity).toBe(0.4);
    });
});
