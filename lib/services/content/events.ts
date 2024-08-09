import { ContentNodeId, UserNodeId } from '../graph';

type PostedEvent = {
    posted: [id: ContentNodeId, user: UserNodeId];
};

type ContentUpdateEvent = {
    contentupdate: [id: ContentNodeId];
    [key: `contentupdate-${ContentNodeId}`]: [];
};

type MissingContentEvent = {
    contentmissing: [id: ContentNodeId];
};

export type ContentEvents = PostedEvent & ContentUpdateEvent & MissingContentEvent;
