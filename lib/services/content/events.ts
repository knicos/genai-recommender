import { ContentNodeId, UserNodeId } from '../graph';

type PostedEvent = {
    posted: [id: ContentNodeId, user: UserNodeId];
};

export type ContentEvents = PostedEvent;
