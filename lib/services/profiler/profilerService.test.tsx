import { beforeEach, describe, it, vi } from 'vitest';
import ServiceBroker from '../broker';
import { GraphService } from '../graph';
import { ContentService } from '../content';
import ProfilerService from './profilerService';
import { createEmptyProfile } from './empty';
import { normalise } from '@base/main';

async function delay(time: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
}

describe('ProfilerService', () => {
    let broker = new ServiceBroker();
    let graph = new GraphService(broker);
    let content = new ContentService(broker, graph);
    let service = new ProfilerService(broker, graph, content);

    beforeEach(() => {
        broker = new ServiceBroker();
        graph = new GraphService(broker);
        content = new ContentService(broker, graph);
        service = new ProfilerService(broker, graph, content);
    });

    describe('reverseProfile', () => {
        it('generates the correct edges', ({ expect }) => {
            content.addContent('data', { id: 'zzz', labels: [] });
            service.createUserProfile('user:xyz', 'TestUser5');

            const testProfile = createEmptyProfile('user:xyz', 'NoName');
            testProfile.affinities.topics.topics = [{ label: 'fff', weight: 0.5 }];
            testProfile.affinities.contents.contents = [{ id: 'content:zzz', weight: 0.5 }];

            service.reverseProfile('user:xyz', testProfile);

            expect(graph.getEdgesOfType('topic', 'user:xyz')).toHaveLength(1);
            expect(graph.getEdgesOfType('engaged', 'user:xyz')).toHaveLength(1);
        });

        it('emits a change event', ({ expect }) => {
            content.addContent('data', { id: 'zzz', labels: [] });
            service.createUserProfile('user:xyz', 'TestUser5');

            const handler = vi.fn();
            broker.on('profile-user:xyz', handler);
            expect(handler).toHaveBeenCalledTimes(0);

            const testProfile = createEmptyProfile('user:xyz', 'NoName');
            testProfile.affinities.topics.topics = [{ label: 'fff', weight: 0.5 }];
            testProfile.affinities.contents.contents = [{ id: 'content:zzz', weight: 0.5 }];

            service.reverseProfile('user:xyz', testProfile);

            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    describe('add from node', () => {
        it('correctly indexes when adding nodes', async ({ expect }) => {
            const profile1 = createEmptyProfile('user:xyz', 'Test1');
            const profile2 = createEmptyProfile('user:zzz', 'Test2');
            profile1.embeddings.taste = normalise([1, 2, 3]);
            profile2.embeddings.taste = normalise([1, 2, 4]);
            graph.addNode('user', 'user:xyz', profile1);
            graph.addNode('user', 'user:zzz', profile2);

            const similar = service.getSimilarUsers(normalise([1, 2, 3]));
            expect(similar).toHaveLength(2);
        });
    });

    describe('Engagement activity', () => {
        it('adds engagement edges upon engagement event', async ({ expect }) => {
            content.addContent('data', { id: 'zzz', labels: [] });
            service.createUserProfile('user:xyz', 'TestUser5');

            broker.emit('activity-engagement', 'user:xyz', 'content:zzz', 1, 100);
            expect(graph.getEdge('engaged', 'user:xyz', 'content:zzz')?.weight).toBe(1);
            expect(graph.getEdge('engaged', 'content:zzz', 'user:xyz')?.weight).toBe(1);
        });
    });

    describe('Follow activity', () => {
        it('logs follow events', async ({ expect }) => {
            service.createUserProfile('user:xyz', 'TestUser5');
            content.addContent('data', { id: 'zzz', labels: [], authorId: 'user:xyz' });

            broker.emit('logdata-follow', 'user:xyz', { id: 'content:zzz', activity: 'follow', timestamp: 100 });

            const profile = service.getUserProfile('user:xyz');
            expect(profile.followsCount).toBe(1);
            expect(profile.followerCount).toBe(1);
        });
    });

    describe('getUserContent()', () => {
        it('returns all authored content in chronological order', async ({ expect }) => {
            service.createUserProfile('user:xyz', 'TestUser6');
            content.addContent('data', { id: '1', labels: [], authorId: 'user:xyz' });
            content.addContent('data', { id: '2', labels: [], authorId: 'user:xyz' });
            content.addContent('data', { id: '3', labels: [], authorId: 'user:xyz' });

            const ownContent = service.getUserContent('user:xyz');
            expect(ownContent).toHaveLength(3);
            expect(ownContent).toContain('content:1');
            expect(ownContent).toContain('content:2');
            expect(ownContent).toContain('content:3');
        });

        it('returns most recent only', async ({ expect }) => {
            service.createUserProfile('user:xyz', 'TestUser6');
            content.addContent('data', { id: '1', labels: [], authorId: 'user:xyz' });
            await delay(100);
            content.addContent('data', { id: '2', labels: [], authorId: 'user:xyz' });
            await delay(100);
            content.addContent('data', { id: '3', labels: [], authorId: 'user:xyz' });

            const ownContent = service.getUserContent('user:xyz', 2);
            expect(ownContent).toHaveLength(2);
            expect(ownContent[0]).toBe('content:3');
            expect(ownContent[1]).toBe('content:2');
        });
    });
});
