import { UserNodeId } from '../graph/graphTypes';
import { GraphService } from '../graph';
import { ContentAffinities, TopicAffinities, UserAffinities } from './profilerTypes';
import { getTopicLabel } from '@base/helpers/topics';

const TIME_WINDOW = 60 * 60 * 1000;
const TIME_DECAY = 0.2;

export function getTopicAffinities(graph: GraphService, id: UserNodeId, count: number): TopicAffinities {
    return {
        topics: graph.getRelated('topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY }).map((v) => ({
            label: getTopicLabel(v.id),
            weight: v.weight,
        })),
        commentedTopics: graph
            .getRelated('commented_topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY })
            .map((r) => ({
                label: getTopicLabel(r.id),
                weight: r.weight,
            })),
        seenTopics: graph.getRelated('seen_topic', id, { period: TIME_WINDOW, timeDecay: TIME_DECAY }).map((r) => ({
            label: getTopicLabel(r.id),
            weight: r.weight,
        })),
        sharedTopics: graph
            .getRelated('shared_topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY })
            .map((r) => ({
                label: getTopicLabel(r.id),
                weight: r.weight,
            })),
        followedTopics: graph
            .getRelated('followed_topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY })
            .map((r) => ({
                label: getTopicLabel(r.id),
                weight: r.weight,
            })),
        reactedTopics: graph
            .getRelated('reacted_topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY })
            .map((r) => ({
                label: getTopicLabel(r.id),
                weight: r.weight,
            })),
        viewedTopics: graph
            .getRelated('viewed_topic', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY })
            .map((r) => ({
                label: getTopicLabel(r.id),
                weight: r.weight,
            })),
    };
}

export function getContentAffinities(graph: GraphService, id: UserNodeId, count: number): ContentAffinities {
    return {
        contents: graph.getRelated('engaged', id, { count, period: TIME_WINDOW, timeDecay: TIME_DECAY }),
    };
}

export function getUserAffinities(): UserAffinities {
    return {
        users: [],
    };
}
