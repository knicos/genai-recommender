import { GraphService, UserNodeId, WeightedNode } from '@base/services/graph';
import { ProfilerService } from '@base/services/profiler';

export function findSimilarUsers(
    graph: GraphService,
    profiler: ProfilerService,
    id: UserNodeId
): WeightedNode<UserNodeId>[] {
    const ownProfile = profiler.getUserProfile(id);
    const similar = profiler.getSimilarUsers(ownProfile.embeddings.taste, 10);

    // Cache the results in the graph
    similar.forEach((sim) => {
        if (sim.weight > 0) graph.addEdge('similar', id, sim.id, sim.weight);
    });

    return similar;
}
