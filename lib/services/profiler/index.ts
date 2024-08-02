import { getBroker } from '../broker';
import { getContentService } from '../content';
import { getGraphService } from '../graph';
import ProfilerService from './profilerService';
export * from './profilerTypes';

export { ProfilerService };

let service: ProfilerService;

export function getProfilerService(): ProfilerService {
    if (!service) {
        service = new ProfilerService(getBroker(), getGraphService(), getContentService());
    }
    return service;
}
