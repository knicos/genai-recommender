import { ContentNodeId, UserNodeId } from '../graph';

type PostedEvent = {
    posted: [id: ContentNodeId, user: UserNodeId];
};

type ContentUpdateEvent = {
    contentupdate: [id: ContentNodeId];
    [key: `contentupdate-${ContentNodeId}`]: [];
};

type ContentMetaEvent = {
    contentmeta: [id: ContentNodeId];
    [key: `contentmeta-${ContentNodeId}`]: [];
};

type MissingContentEvent = {
    contentmissing: [id: ContentNodeId];
};

type CommentEvent = {
    contentcomment: [id: ContentNodeId];
    [key: `contentcomment-${ContentNodeId}`]: [];
};

type ContentStatsEvent = {
    contentstats: [id: ContentNodeId];
    [key: `contentstats-${ContentNodeId}`]: [];
};

export type ContentEvents = PostedEvent &
    ContentUpdateEvent &
    MissingContentEvent &
    CommentEvent &
    ContentStatsEvent &
    ContentMetaEvent;
