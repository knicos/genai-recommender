import { ContentService } from '@base/services/content';
import { ContentNodeId } from '@base/services/graph/graphTypes';
import { UserNodeData } from '@base/services/profiler';
import { normCosinesim } from '@base/utils/embedding';

// Determined by experiment, embeddings always have some degree of similarity so remove that.
const BASE_EMBEDDING_SIMILARITY = 0.8;

export function calculateEmbeddingScore(
    content: ContentService,
    profile: UserNodeData,
    id: ContentNodeId
): number | undefined {
    const meta = content.getContentMetadata(id);
    if (meta && meta.embedding && profile.embeddings.taste.length > 0) {
        const sim = normCosinesim(meta.embedding, profile.embeddings.taste);
        return Math.max(0, (sim - BASE_EMBEDDING_SIMILARITY) / (1 - BASE_EMBEDDING_SIMILARITY));
    }
}
