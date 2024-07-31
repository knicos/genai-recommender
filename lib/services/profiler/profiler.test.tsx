import { beforeEach, describe, it, vi } from 'vitest';
import { createEmptyProfile, createUserProfile, resetProfiles, reverseProfile } from '@base/services/profiler/profiler';
import { resetGraph } from '@base/services/graph/state';
import { getEdgesOfType } from '@base/services/graph/edges';
import { addNode } from '@base/services/graph/nodes';
import { addProfileListener } from './events';

beforeEach(() => {
    resetGraph();
    resetProfiles();
});

describe('Profiler.updateProfile', () => {
    it('generates the correct edges', ({ expect }) => {
        addNode('content', 'content:zzz');
        createUserProfile('user:xyz', 'TestUser5');

        const testProfile = createEmptyProfile('user:xyz', 'NoName');
        testProfile.affinities.topics.topics = [{ label: 'fff', weight: 0.5 }];
        testProfile.affinities.contents.contents = [{ id: 'content:zzz', weight: 0.5 }];

        reverseProfile('user:xyz', testProfile);

        expect(getEdgesOfType('topic', 'user:xyz')).toHaveLength(1);
        expect(getEdgesOfType('engaged', 'user:xyz')).toHaveLength(1);
    });

    it('emits a change event', ({ expect }) => {
        addNode('content', 'content:zzz');
        createUserProfile('user:xyz', 'TestUser5');

        const handler = vi.fn();
        addProfileListener('user:xyz', handler);
        expect(handler).toHaveBeenCalledTimes(0);

        const testProfile = createEmptyProfile('user:xyz', 'NoName');
        testProfile.affinities.topics.topics = [{ label: 'fff', weight: 0.5 }];
        testProfile.affinities.contents.contents = [{ id: 'content:zzz', weight: 0.5 }];

        reverseProfile('user:xyz', testProfile);

        expect(handler).toHaveBeenCalledTimes(1);
    });
});
