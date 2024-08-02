import { getBroker } from '../broker';
import GraphService from './graphService';
export * from './graphTypes';

export { GraphService };

let service: GraphService;

export function getGraphService(): GraphService {
    if (!service) {
        service = new GraphService(getBroker());
    }
    return service;
}
