import { UserNodeId } from '../graph';
import defaults from './defaultWeights.json';
import { UserNodeData } from './profilerTypes';

const defaultWeights = Array.from(Object.values(defaults));
const weightKeys = Array.from(Object.keys(defaults));
export { defaultWeights, weightKeys };

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
        featureWeights: { ...defaults },
        embeddings: {
            taste: new Array(20).fill(0),
        },
        lastUpdated: Date.now(),
        followerCount: 0,
        followsCount: 0,
    };
}
