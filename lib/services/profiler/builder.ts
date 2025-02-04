import { UserNodeId } from '../graph/graphTypes';
import { getContentAffinities, getTopicAffinities, getUserAffinities } from './affinities';
import { generateEmbedding, generateLabelEmbedding } from './userEmbedding';
import { Affinities, ProfilingOptions, UserNodeData } from './profilerTypes';
import { GraphService } from '../graph';
import { ContentService } from '../content';
import { Embedding } from '@base/main';

const PROFILE_COUNTS = 10;

/** When a profile is flagged as out-of-date, rebuild the summary and embeddings. */
export function buildUserProfile(
    graph: GraphService,
    content: ContentService,
    id: UserNodeId,
    data?: UserNodeData,
    options?: ProfilingOptions
): UserNodeData {
    const aid = id;
    const affinities: Affinities = {
        topics: getTopicAffinities(graph, aid, options?.summarySize || PROFILE_COUNTS),
        contents: getContentAffinities(graph, aid, options?.summarySize || PROFILE_COUNTS),
        users: getUserAffinities(),
    };

    // const seenItems = getRelated('seen', aid, { period: TIME_WINDOW });

    // Update the embedding
    let embedding: Embedding;
    if (options?.embeddingType === 'labels') {
        embedding = generateLabelEmbedding(graph, affinities.topics.topics);
    } else {
        embedding = generateEmbedding(graph, content, aid, options);
    }

    const image = content.getSimilarContent(
        embedding,
        1,
        affinities.contents.contents.map((e) => e.id)
    )[0]?.id;

    if (!data) {
        console.error('No data for', aid);
        throw new Error('no_profile_data');
    }

    data.affinities = affinities;
    data.embeddings.taste = embedding;
    data.embeddings.type = options?.embeddingType || 'taste';
    data.image = image;
    data.engagement = affinities.contents.contents.reduce((s, v) => s + v.weight, 0);
    data.lastUpdated = Date.now();

    // globalScore.engagement = Math.max(globalScore.engagement, newProfile.engagement);

    return data;
}
