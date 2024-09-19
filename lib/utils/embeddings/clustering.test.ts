import { describe, it } from 'vitest';
import HierarchicalEmbeddingCluster from './clustering';
import { Embedding, normalise } from './general';
import { NodeID } from '@base/main';

const data1: { id: NodeID; embedding: Embedding }[] = [
    { id: 'content:1', embedding: normalise([0.7, 1, 0, 0]) },
    { id: 'content:2', embedding: normalise([0.8, 1, 0, 0]) },
    { id: 'content:3', embedding: normalise([0.9, 1, 0, 0]) },
    { id: 'content:4', embedding: normalise([1, 1, 0, 0]) },
    { id: 'content:5', embedding: normalise([0, 1, 1, 0]) },
    { id: 'content:6', embedding: normalise([0, 1, 1, 0]) },
    { id: 'content:7', embedding: normalise([0, 1, 1, 0]) },
    { id: 'content:8', embedding: normalise([0, 1, 1, 0]) },
    { id: 'content:9', embedding: normalise([0, 0, 1, 0.7]) },
    { id: 'content:10', embedding: normalise([0, 0, 0.9, 0.8]) },
    { id: 'content:11', embedding: normalise([0, 0, 0.8, 0.9]) },
    { id: 'content:12', embedding: normalise([0, 0, 0.7, 1]) },
];

describe('HierarchicalCluster', () => {
    it('generates 2 clusters', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            k: 2,
        });

        cluster.calculate(data1);

        const clusters = cluster.getClusters();
        expect(clusters).toHaveLength(2);
    });

    it('generates 3 clusters', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            k: 3,
        });

        cluster.calculate(data1);

        const clusters = cluster.getClusters();
        expect(clusters).toHaveLength(3);
    });

    it('generates 4 clusters', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            k: 4,
        });

        cluster.calculate(data1);

        const clusters = cluster.getClusters();
        expect(clusters).toHaveLength(4);
    });

    it('can cluster random data', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            k: 4,
        });

        const data: { id: NodeID; embedding: Embedding }[] = [];
        for (let i = 0; i < 200; ++i) {
            const e = new Array(10).fill(0);
            data.push({ id: `content:${i}`, embedding: normalise(e.map(() => Math.random())) });
        }

        cluster.calculate(data);

        const clusters = cluster.getClusters();
        expect(clusters).toHaveLength(4);

        const match = new Set<number>();
        clusters.forEach((cluster) => {
            cluster.forEach((member) => {
                expect(match.has(member)).toBe(false);
                match.add(member);
            });
        });
    });

    it('can cluster using maxDistance', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            maxDistance: 0.5,
        });

        const data: { id: NodeID; embedding: Embedding }[] = [];
        for (let i = 0; i < 200; ++i) {
            const e = new Array(10).fill(0);
            data.push({ id: `content:${i}`, embedding: normalise(e.map(() => Math.random())) });
        }

        cluster.calculate(data);

        const clusters = cluster.getClusters();
        expect(clusters.length).toBeGreaterThan(2);
    });

    it('produces more clusters than k', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            maxDistance: 0.1,
            k: 4,
        });

        const data: { id: NodeID; embedding: Embedding }[] = [];
        for (let i = 0; i < 200; ++i) {
            const e = new Array(10).fill(0);
            data.push({ id: `content:${i}`, embedding: normalise(e.map(() => Math.random())) });
        }

        cluster.calculate(data);

        const clusters = cluster.getClusters();
        expect(clusters.length).toBeGreaterThan(4);
    });

    it('can be forced to a fix number of clusters', async ({ expect }) => {
        const cluster = new HierarchicalEmbeddingCluster({
            maxDistance: 0.1,
            maxClusters: 4,
        });

        const data: { id: NodeID; embedding: Embedding }[] = [];
        for (let i = 0; i < 200; ++i) {
            const e = new Array(10).fill(0);
            data.push({ id: `content:${i}`, embedding: normalise(e.map(() => Math.random())) });
        }

        cluster.calculate(data);

        const clusters = cluster.getClusters();
        expect(clusters).toHaveLength(4);
    });
});
