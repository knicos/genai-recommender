import { getBroker } from '../broker';
import { getContentService } from '../content';
import { getGraphService } from '../graph';
import { getProfilerService } from '../profiler';
import RecommenderService from './recommenderService';
export * from './recommenderTypes';

export { RecommenderService };

let service: RecommenderService;

export function getRecommenderService(): RecommenderService {
    if (!service) {
        service = new RecommenderService(getBroker(), getGraphService(), getContentService(), getProfilerService());
    }
    return service;
}
