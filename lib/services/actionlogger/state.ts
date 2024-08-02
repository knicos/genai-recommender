import { ContentNodeId, UserNodeId } from '../graph/graphTypes';
import { LogActivity, LogEntry } from './actionlogTypes';

export interface UserLogEntry {
    entry: LogEntry;
    user: UserNodeId;
}

export type UserContentId = `${UserNodeId}--${ContentNodeId}`;

export default class ActionLogState {
    public logs = new Map<UserNodeId, LogEntry[]>();
    public logsByType = new Map<LogActivity, UserLogEntry[]>();
    public engagementRecord = new Map<UserContentId, number>();

    public reset() {
        this.logs.clear();
        this.logsByType.clear();
    }

    deleteLogs(id: UserNodeId) {
        this.logs.delete(id);
        this.logsByType.forEach((l, k) => {
            this.logsByType.set(
                k,
                l.filter((v) => v.user !== id)
            );
        });
    }
}
