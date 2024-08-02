import { beforeEach, describe, it } from 'vitest';
import { Embedding, normalise } from '@base/utils/embedding';
import { ProfilerService } from '@base/services/profiler';
import { GraphService, UserNodeId } from '@base/services/graph';
import ServiceBroker from '@base/services/broker';
import { ContentService } from '@base/services/content';
import clusterUsers from './clusterUsers';

function makeProfile(profiler: ProfilerService, id: UserNodeId, embedding: Embedding) {
    profiler.createUserProfile(id, 'TestUser');
    const profile = profiler.getUserData(id);
    if (profile) {
        profile.embeddings = { taste: normalise(embedding) };
    }
}

describe('SimilarityService', () => {
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

    describe('clusterUsers()', () => {
        it('clusters no users', async ({ expect }) => {
            const result = clusterUsers(profiler, [], 4);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(0);
        });

        it('clusters one user', async ({ expect }) => {
            makeProfile(profiler, 'user:xyz', [0.2, 0.1]);

            const result = clusterUsers(profiler, ['user:xyz'], 4);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(1);
            expect(result.get('user:xyz')?.label).toBe('cluster0');
        });

        it('clusters many users', async ({ expect }) => {
            makeProfile(profiler, 'user:test1', [0.5, 0.1]);
            makeProfile(profiler, 'user:test2', [0.6, 0.2]);
            makeProfile(profiler, 'user:test3', [0.2, 0.5]);
            makeProfile(profiler, 'user:test4', [0.1, 0.4]);

            const result = clusterUsers(profiler, ['user:test1', 'user:test2', 'user:test3', 'user:test4'], 2);
            expect(result).toBeInstanceOf(Map);
            expect(result.size).toBe(4);
            expect(result.get('user:test1')?.label).toBe('cluster0');
            expect(result.get('user:test2')?.label).toBe('cluster0');
            expect(result.get('user:test3')?.label).toBe('cluster1');
            expect(result.get('user:test4')?.label).toBe('cluster1');
        });
    });
});
