import { getBroker } from '../broker';
import ActionLogService from './actionlogService';
export * from './actionlogTypes';

export { ActionLogService };

let service: ActionLogService;

export function getActionLogService(): ActionLogService {
    if (!service) {
        service = new ActionLogService(getBroker());
    }
    return service;
}