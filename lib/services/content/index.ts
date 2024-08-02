import { getBroker } from '../broker';
import { getGraphService } from '../graph';
import ContentService from './contentService';
export * from './contentTypes';
export { default as AutoEncoder } from './autoencoder';
export { default as MobileNetEmbedding } from './mobilenet';

export { ContentService };

let service: ContentService;

export function getContentService(): ContentService {
    if (!service) {
        service = new ContentService(getBroker(), getGraphService());
    }
    return service;
}
