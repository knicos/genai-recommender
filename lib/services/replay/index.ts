import { getActionLogService } from '../actionlogger';
import { getContentService } from '../content';
import { getProfilerService } from '../profiler';
import ReplayService from './replayService';

export { ReplayService };

let service: ReplayService;

export function getReplayService(): ReplayService {
    if (!service) {
        service = new ReplayService(getProfilerService(), getContentService(), getActionLogService());
    }
    return service;
}
