import { WeightedLabel } from '@base/services/content';
import { UserNodeId } from '@base/services/graph';
import { ProfilerService } from '@base/services/profiler';
import { clusterEmbeddings } from '@base/utils/embedding';

export default function clusterUsers(
    profiler: ProfilerService,
    users: UserNodeId[],
    k: number
): Map<UserNodeId, WeightedLabel> {
    const clusters = new Map<UserNodeId, WeightedLabel>();

    const userEmbeddings = users
        .map((user) => ({ id: user, embedding: profiler.getUserProfile(user)?.embeddings.taste || [] }))
        .filter((u) => u.embedding.length > 0);
    const rawClusters = clusterEmbeddings(userEmbeddings, { k });

    rawClusters.forEach((cluster, ix) => {
        cluster.forEach((member) => {
            clusters.set(userEmbeddings[member].id, { label: `cluster${ix}`, weight: 1 });
        });
    });

    return clusters;
}
