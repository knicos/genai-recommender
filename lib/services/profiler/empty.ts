import { UserNodeId } from '../graph';
import { UserNodeData } from './profilerTypes';

export function createEmptyProfile(id: UserNodeId, name: string): UserNodeData {
    return {
        id,
        name: name,
        engagement: -1,
        affinities: {
            topics: {
                topics: [],
                seenTopics: [],
                viewedTopics: [],
                commentedTopics: [],
                sharedTopics: [],
                reactedTopics: [],
                followedTopics: [],
            },
            contents: {
                contents: [],
            },
            users: {
                users: [],
            },
        },
        featureWeights: {},
        embeddings: {
            taste: new Array(20).fill(0),
            type: 'taste',
        },
        lastUpdated: Date.now(),
        followerCount: 0,
        followsCount: 0,
        cold: 1,
    };
}
