import { GraphService, TopicNodeId } from '@base/services/graph';

export function addTopic(graph: GraphService, label: string) {
    const id = graph.addNode('topic', `topic:${label}`, { label });
    return id;
}

export function getTopicId(graph: GraphService, label: string) {
    const id: TopicNodeId = `topic:${label}`;
    if (!graph.hasNode(id)) {
        addTopic(graph, label);
    }
    return id;
}

export function getTopicLabel(id: TopicNodeId) {
    return id.split(':')[1] || '';
}
