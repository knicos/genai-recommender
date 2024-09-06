import { describe, it } from 'vitest';
import ServiceBroker from '../broker';
import { GraphService } from '../graph';
import { engagementEmbedding } from './engagementEmbedding';

describe('engagementEmbeddings()', () => {
    it('generates a dimension per user', async ({ expect }) => {
        const broker = new ServiceBroker();
        const graph = new GraphService(broker);

        graph.addNode('user', 'user:x');
        graph.addNode('user', 'user:y');
        graph.addNode('content', 'content:1');
        graph.addNode('content', 'content:2');
        graph.addNode('content', 'content:3');

        graph.addEdge('engaged', 'user:x', 'content:1', 1);
        graph.addEdge('engaged', 'user:x', 'content:2', 0.5);
        graph.addEdge('engaged', 'user:x', 'content:3', 0.1);
        graph.addEdge('engaged', 'user:y', 'content:1', 0.1);
        graph.addEdge('engaged', 'user:y', 'content:2', 0.5);
        graph.addEdge('engaged', 'user:y', 'content:3', 1);

        const embeddings = engagementEmbedding(graph);
        expect(embeddings).toHaveLength(3);
        expect(embeddings[0]).toHaveLength(2);
        expect(embeddings[0][0]).toBeGreaterThan(0.9);
        expect(embeddings[0][1]).toBeLessThan(0.1);
    });
});
