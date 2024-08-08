import { ContentNodeId, UserNodeId, WeightedNode } from '@base/services/graph/graphTypes';
import defaults from './defaultWeights.json';
import { Embedding } from '@base/utils/embedding';
import { WeightedLabel } from '../content';
import { Scores } from '../recommender/recommenderTypes';

export interface UserEmbeddings {
    taste: Embedding;
}

export interface TopicAffinities {
    topics: WeightedLabel[];
    seenTopics: WeightedLabel[];
    commentedTopics: WeightedLabel[];
    sharedTopics: WeightedLabel[];
    reactedTopics: WeightedLabel[];
    followedTopics: WeightedLabel[];
    viewedTopics: WeightedLabel[];
}

export interface ContentAffinities {
    contents: WeightedNode<ContentNodeId>[];
}

export interface UserAffinities {
    users: WeightedNode<UserNodeId>[];
}

export interface Affinities {
    topics: TopicAffinities;
    contents: ContentAffinities;
    users: UserAffinities;
}

export interface UserNodeData {
    id: UserNodeId;
    name: string;
    featureWeights: Scores; // This will be deprecated
    embeddings: UserEmbeddings;
    affinities: Affinities;
    image?: ContentNodeId;
    engagement: number;
    lastUpdated: number;
    followerCount: number;
    followsCount: number;
}

export type Features = typeof defaults;

export interface InternalUserProfile {
    id: UserNodeId;
    profile: UserNodeData;
    positiveRecommendations: number;
    negativeRecommendations: number;
    seenItems: number;
    engagementTotal: number;
}
