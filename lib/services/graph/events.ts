import { EdgeType, NodeID, NodeType } from './graphTypes';

type NodeEvent = {
    [key: `node-${NodeID}`]: [];
};

type NodeTypeEvent = {
    [key in `nodetype-${NodeType}`]: [id: NodeID];
};

type NodeNewTypeEvent = {
    [key in `newnodetype-${NodeType}`]: [id: NodeID];
};

type NodeRemoveTypeEvent = {
    [key in `removenodetype-${NodeType}`]: [id: NodeID];
};

type NodeEdgeTypeEvent = {
    [key in `nodeedgetype-${NodeID}-${EdgeType}`]: [];
};

type EdgeTypeEvent = {
    [key in `edgetype-${EdgeType}`]: [id: NodeID];
};

export type GraphEvents = NodeEvent &
    NodeTypeEvent &
    NodeEdgeTypeEvent &
    EdgeTypeEvent &
    NodeNewTypeEvent &
    NodeRemoveTypeEvent;
