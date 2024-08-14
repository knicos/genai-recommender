import { beforeEach, describe, it } from 'vitest';
import { candidateProbabilities, generateCandidates } from './candidates';
import { CandidateOptions } from './recommenderTypes';
import { normalise } from '@base/utils/embedding';
import { ProfilerService } from '../profiler';
import { ContentService } from '../content';
import { GraphService } from '../graph';
import ServiceBroker from '../broker';
import { addTopic } from '@base/helpers/topics';
import { createEmptyProfile } from '../profiler/empty';

const DEFAULT_OPTIONS: CandidateOptions = {
    random: 2,
    taste: 2,
    coengaged: 2,
    similarUsers: 2,
    popular: 2,
};

describe('Candidates.generateCandidates()', () => {
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

    it('returns no candidates if there is no data', async ({ expect }) => {
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates = generateCandidates(graph, content, profiler, profile, 10, DEFAULT_OPTIONS);
        expect(candidates).toHaveLength(0);
    });

    it('returns a random candidate if no other candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates = generateCandidates(graph, content, profiler, profile, 10, {
            ...DEFAULT_OPTIONS,
            popular: 0,
        });
        expect(candidates).toHaveLength(1);
        expect(candidates[0].candidateOrigin).toBe('random');
        expect(candidates[0].contentId).toBe('content:ggg');
    });

    it('returns popular candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        content.addContentEngagement('content:ggg', 2);
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        const candidates = generateCandidates(graph, content, profiler, profile, 10, {
            ...DEFAULT_OPTIONS,
            random: 0,
        });
        expect(candidates).toHaveLength(1);
        expect(candidates[0].candidateOrigin).toBe('popular');
        expect(candidates[0].contentId).toBe('content:ggg');
        expect(candidates[0].popularityScore).toBe(1);
    });

    it('generates taste candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        const topicID = addTopic(graph, 'topic1');
        graph.addEdge('content', topicID, 'content:ggg', 1.0);
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        profile.affinities.topics.topics = [{ label: 'topic1', weight: 0.5 }];
        const candidates = generateCandidates(graph, content, profiler, profile, 10, {
            ...DEFAULT_OPTIONS,
            random: 0,
            popular: 0,
        });

        expect(candidates).toHaveLength(1);
        expect(candidates[0].candidateOrigin).toBe('topic_affinity');
        expect(candidates[0].contentId).toBe('content:ggg');
        expect(candidates[0].topicAffinity).toBe(0.5);
    });

    it('generates similar user candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        const profile1 = profiler.createUserProfile('user:xyz', 'TestUser');
        const profile2 = profiler.createUserProfile('user:test1', 'TestUser2');
        profile1.embeddings.taste = normalise([1, 2, 3]);
        profile2.embeddings.taste = normalise([1, 2, 3]);
        profile2.affinities.contents.contents = [{ id: 'content:ggg', weight: 1 }];
        profiler.indexUser(profile1.id);
        profiler.indexUser(profile2.id);
        const candidates = generateCandidates(graph, content, profiler, profile1, 10, {
            ...DEFAULT_OPTIONS,
            random: 0,
            popular: 0,
        });

        expect(candidates).toHaveLength(1);
        expect(candidates[0].candidateOrigin).toBe('similar_user');
        expect(candidates[0].contentId).toBe('content:ggg');
    });
});

describe('Candidates.candidateProbabilities()', () => {
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

    it('calculates a probability for popular candidates', async ({ expect }) => {
        content.addContent('', { id: '1', labels: [] });
        content.addContentEngagement('content:1', 0.5);
        const p = candidateProbabilities(
            graph,
            content,
            profiler,
            createEmptyProfile('user:1', 'Test'),
            5,
            { popular: 2, taste: 0, coengaged: 0, similarUsers: 0, random: 0 },
            'content:1'
        );

        expect(p).toBe(1);
    });

    it('calculates a probability for random candidates', async ({ expect }) => {
        content.addContent('', { id: '1', labels: [] });
        content.addContent('', { id: '2', labels: [] });
        content.addContent('', { id: '3', labels: [] });
        content.addContent('', { id: '4', labels: [] });
        content.addContent('', { id: '5', labels: [] });
        const p1 = candidateProbabilities(
            graph,
            content,
            profiler,
            createEmptyProfile('user:1', 'Test'),
            5,
            { popular: 0, taste: 0, coengaged: 0, similarUsers: 0, random: 2 },
            'content:1'
        );
        const p2 = candidateProbabilities(
            graph,
            content,
            profiler,
            createEmptyProfile('user:2', 'Test'),
            5,
            { popular: 0, taste: 0, coengaged: 0, similarUsers: 0, random: 2 },
            'content:4'
        );

        expect(p1).toBeCloseTo(p2);
    });

    it('calculates a probability for taste candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        const topicID = addTopic(graph, 'topic1');
        graph.addEdge('content', topicID, 'content:ggg', 1.0);
        graph.addEdge('topic', 'content:ggg', topicID, 1.0);
        const profile = profiler.createUserProfile('user:xyz', 'TestUser');
        profile.affinities.topics.topics = [{ label: 'topic1', weight: 0.5 }];
        const p = candidateProbabilities(
            graph,
            content,
            profiler,
            profile,
            5,
            { popular: 0, taste: 2, coengaged: 0, similarUsers: 0, random: 0 },
            'content:ggg'
        );

        expect(p).toBe(1);
    });

    it('calculates a probability for similar user candidates', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        const profile1 = profiler.createUserProfile('user:xyz', 'TestUser');
        const profile2 = profiler.createUserProfile('user:test1', 'TestUser2');
        profile1.embeddings.taste = normalise([1, 2, 3]);
        profile2.embeddings.taste = normalise([1, 2, 3]);
        profile2.affinities.contents.contents = [{ id: 'content:ggg', weight: 1 }];
        profiler.indexUser(profile1.id);
        profiler.indexUser(profile2.id);
        const p = candidateProbabilities(
            graph,
            content,
            profiler,
            profile1,
            5,
            { popular: 0, taste: 0, coengaged: 0, similarUsers: 2, random: 0 },
            'content:ggg'
        );

        expect(p).toBe(1);
    });

    it('zero probability if not matched', async ({ expect }) => {
        content.addContent('', { id: 'ggg', labels: [] });
        content.addContent('', { id: 'xxx', labels: [] });
        const profile1 = profiler.createUserProfile('user:xyz', 'TestUser');
        const profile2 = profiler.createUserProfile('user:test1', 'TestUser2');
        profile1.embeddings.taste = normalise([1, 2, 3]);
        profile2.embeddings.taste = normalise([1, 2, 3]);
        profile2.affinities.contents.contents = [{ id: 'content:ggg', weight: 1 }];
        profiler.indexUser(profile1.id);
        profiler.indexUser(profile2.id);
        const p = candidateProbabilities(
            graph,
            content,
            profiler,
            profile1,
            5,
            { popular: 0, taste: 0, coengaged: 0, similarUsers: 2, random: 0 },
            'content:xxx'
        );

        expect(p).toBe(0);
    });
});
