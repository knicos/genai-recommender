import { ContentNodeId, GraphService } from '../graph';

export function engagementEmbedding(graph: GraphService, images: ContentNodeId[], fixedImages: ContentNodeId[]) {
    const engagements = images.map((c) => fixedImages.map((v) => graph.getEdgeWeights('coengaged', c, v)[0] || 0));
    return engagements;
}
