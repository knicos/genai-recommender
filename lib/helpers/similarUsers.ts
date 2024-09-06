import { GraphService, UserNodeId, WeightedNode } from '@base/services/graph';
import { ProfilerService, SimilarityOptions } from '@base/services/profiler';

export function findSimilarUsers(
    graph: GraphService,
    profiler: ProfilerService,
    id: UserNodeId,
    options?: SimilarityOptions
): WeightedNode<UserNodeId>[] {
    const ownProfile = profiler.getUserProfile(id);
    const similar = profiler.getSimilarUsers(ownProfile.embeddings.taste, options);

    // Cache the results in the graph
    similar.forEach((sim) => {
        if (sim.weight > 0) graph.addEdge('similar', id, sim.id, sim.weight);
    });

    return similar;
}
