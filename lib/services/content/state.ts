import { ContentNodeId } from '../graph';
import { CommentEntry, ContentMetadata, ContentStats } from './contentTypes';

export default class ContentState {
    public dataStore = new Map<ContentNodeId, string>();
    public metaStore = new Map<ContentNodeId, ContentMetadata>();
    public commentStore = new Map<ContentNodeId, CommentEntry[]>();
    public statsStore = new Map<ContentNodeId, ContentStats>();

    public reset() {
        this.dataStore.clear();
        this.metaStore.clear();
        this.commentStore.clear();
        this.statsStore.clear();
    }
}
