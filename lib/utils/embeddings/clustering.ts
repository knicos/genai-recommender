import { NodeID } from '@base/services/graph/graphTypes';
import { Embedding, embeddingLength, normalise } from './general';
import { maxEmbeddingDistance, normCosinesim } from './similarity';

interface ClusterNode {
    active: boolean;
    members: number[];
    distances: number[];
    centralMember?: number;
}

export interface ClusterOptions {
    k?: number;
    maxClusters?: number;
    maxDistance?: number;
    minClusterSize?: number;
}

export default class HierarchicalEmbeddingCluster {
    private k: number;
    private maxDistance: number;
    private maxClusters: number;
    private minClusterSize: number;
    private clusters: ClusterNode[] = [];
    private indexMap = new Map<NodeID, number>();

    constructor(options: ClusterOptions) {
        this.k = options.k || 2;
        this.maxClusters = options.maxClusters || 10000;
        this.maxDistance = options.maxDistance || 1;
        this.minClusterSize = options.minClusterSize || 10000;
    }

    public createFeatureVector(id: NodeID) {
        const index = this.indexMap.get(id);
        if (index === undefined) throw new Error('invalid_node');

        const selected = this.clusters.filter((c) => c.active);
        const vector = selected.map((cluster) =>
            cluster.members.findIndex((v) => v === index) === -1 ? 0 : 1 - 1 / cluster.members.length
        );
        return vector;
    }

    public createFeatureVectors() {
        const selected = this.clusters.filter((c) => c.active);
        return this.clusters.map((_, i) =>
            normalise(
                selected.map((cluster) => {
                    return 1 / (cluster.distances[i] + 1);
                })
            )
        );
    }

    public calculate(data: { id: NodeID; embedding: Embedding }[]) {
        this.clusters = data.map((_, ix) => ({
            members: [ix],
            active: true,
            distances: data.map((d) => 1 - normCosinesim(d.embedding, data[ix].embedding)),
        }));
        data.forEach((d, i) => {
            this.indexMap.set(d.id, i);
        });
        const minPair = { d: 0, a: -1, b: -1 };

        if (data.length > 0) {
            const l = embeddingLength(data[0].embedding);
            if (Math.abs(l - 1) > Number.EPSILON * 10) {
                // throw new Error('Embeddings are not normalised');
                console.error('Embeddings are not normalised');
            }
        }

        let count = this.clusters.length;
        let csize = 1;

        while (
            count > this.maxClusters ||
            (count > this.k && minPair.d <= this.maxDistance && csize < this.minClusterSize)
        ) {
            minPair.d = 2; // Reset distance
            csize = this.clusters.length;
            // Find minimum distance
            for (let i = 0; i < this.clusters.length; ++i) {
                if (this.clusters[i].active === false) continue;
                csize = Math.min(csize, this.clusters[i].members.length);

                for (let j = i + 1; j < this.clusters.length; ++j) {
                    if (this.clusters[j].active === false) continue;

                    const dist = this.clusters[i].distances[j];
                    if (dist < minPair.d) {
                        minPair.d = dist;
                        minPair.a = i;
                        minPair.b = j;
                    }
                }
            }

            // Merge min
            this.clusters[minPair.a].members.push(...this.clusters[minPair.b].members);
            this.clusters[minPair.b].active = false;

            // Only update the distances that changed.
            const cembed = this.clusters[minPair.a].members.map((m) => data[m].embedding);
            this.clusters.forEach((c, ix) => {
                if (c.active) {
                    const d = maxEmbeddingDistance(
                        c.members.map((m) => data[m].embedding),
                        cembed
                    );
                    c.distances[minPair.a] = d;
                    this.clusters[minPair.a].distances[ix] = d;
                }
            });
            --count;
        }

        this.clusters.forEach((cluster) => {
            if (cluster.active) {
                let totalW = 0;
                let s = 0;
                cluster.members.forEach((m) => {
                    const w = (cluster.distances[m] + 1) / 2;
                    totalW += w * w;
                    s += w * w * m;
                });
                cluster.centralMember = totalW > 0 ? s / totalW : 0;
            }
        });
    }

    public getClusters() {
        const filtered = this.clusters.filter((c) => c.active);
        filtered.sort((a, b) => (a.centralMember || 0) - (b.centralMember || 0));
        return filtered.map((c) => c.members);
    }
}
