import { UserNodeId } from '../graph/graphTypes';
import { ScoredRecommendation } from './recommenderTypes';

type RecommendationEvent = {
    [key: `recom-${UserNodeId}`]: [results: ScoredRecommendation[]];
};

export type RecommendationEvents = RecommendationEvent;
