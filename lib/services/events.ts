import { LogEvents } from './actionlogger/events';
import { GraphEvents } from './graph/events';
import { ProfileEvents } from './profiler/events';
import { RecommendationEvents } from './recommender/events';

export type ServiceEvents = GraphEvents & LogEvents & ProfileEvents & RecommendationEvents;
