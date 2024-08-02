import { describe, it, beforeEach } from 'vitest';
import GraphService from './graphService';
import ServiceBroker from '../broker';

describe('graph.addNode', () => {
    let broker = new ServiceBroker();
    let service = new GraphService(broker);
    beforeEach(() => {
        broker = new ServiceBroker();
        service = new GraphService(broker);
    });

    it('gives an id after adding', async ({ expect }) => {
        const id = service.addNode('content');
        expect(id).toBeTypeOf('string');
        expect(id.length).toBeGreaterThan(5);
    });

    it('uses the same id if provided', async ({ expect }) => {
        const id = service.addNode('content', 'content:mytestid');
        expect(id).toBe('content:mytestid');
    });

    it('throws if the id already exists', async ({ expect }) => {
        service.addNode('content', 'content:mytestid');
        expect(() => service.addNode('content', 'content:mytestid')).toThrowError('id_exists');
    });
});

describe('graph.getNodeType', () => {
    let broker = new ServiceBroker();
    let service = new GraphService(broker);
    beforeEach(() => {
        broker = new ServiceBroker();
        service = new GraphService(broker);
    });

    it('returns the correct type for a node', async ({ expect }) => {
        const id1 = service.addNode('content');
        const id2 = service.addNode('topic');

        expect(service.getNodeType(id1)).toBe('content');
        expect(service.getNodeType(id2)).toBe('topic');
    });

    it('returns null if the id does not exist', async ({ expect }) => {
        expect(service.getNodeType('somenodeid')).toBeNull();
    });
});

describe('graph.getNodesByType', () => {
    let broker = new ServiceBroker();
    let service = new GraphService(broker);
    beforeEach(() => {
        broker = new ServiceBroker();
        service = new GraphService(broker);
    });

    it('returns all nodes of a type only', async ({ expect }) => {
        const id1 = service.addNode('content');
        const id2 = service.addNode('content');
        const id3 = service.addNode('topic');

        const nodes = service.getNodesByType('content');

        expect(nodes).toHaveLength(2);
        expect(nodes).toContain(id1);
        expect(nodes).toContain(id2);
        expect(nodes).not.toContain(id3);
    });
});
