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

        graph.addEdge('coengaged', 'content:2', 'content:1', 1);
        graph.addEdge('coengaged', 'content:1', 'content:2', 0.5);
        graph.addEdge('coengaged', 'content:1', 'content:3', 0.1);
        graph.addEdge('coengaged', 'content:3', 'content:1', 0.1);
        graph.addEdge('coengaged', 'content:3', 'content:2', 0.5);
        graph.addEdge('coengaged', 'content:2', 'content:3', 1);

        const embeddings = engagementEmbedding(graph, graph.getNodesByType('content'), graph.getNodesByType('content'));
        expect(embeddings).toHaveLength(3);
        expect(embeddings[0]).toHaveLength(3);
        expect(embeddings[0][0]).toBe(0);
        expect(embeddings[0][1]).toBe(0.5);
    });
});
