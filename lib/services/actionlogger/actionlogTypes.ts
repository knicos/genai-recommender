import { ContentNodeId } from '../graph';

export type ReactionType = 'like' | 'unreact';

export type LogActivity =
    | ReactionType
    | 'share_public'
    | 'hide'
    | 'hide_similar'
    | 'comment'
    | 'dwell'
    | 'follow'
    | 'unfollow'
    | 'begin'
    | 'end'
    | 'seen'
    | 'inactive'
    | 'engagement';

export function isReaction(act: LogActivity) {
    switch (act) {
        case 'like':
            return true;
        default:
            return false;
    }
}

export interface LogEntry {
    activity: LogActivity;
    id?: ContentNodeId;
    timestamp: number;
    value?: number;
    content?: string;
}
