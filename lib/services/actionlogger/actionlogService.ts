import { anonString } from '@base/utils/anon';
import ServiceBroker from '../broker';
import { ContentNodeId, UserNodeId } from '../graph';
import { LogActivity, LogEntry } from './actionlogTypes';
import ActionLogState, { UserContentId, UserLogEntry } from './state';
import { activityEngagement, commentEngagement, dwellEngagement } from './engagement';

export default class ActionLogService {
    public readonly broker: ServiceBroker;
    private state = new ActionLogState();

    constructor(broker: ServiceBroker) {
        this.broker = broker;
    }

    private increaseContentEngagement(uid: UserNodeId, cid: ContentNodeId, value: number) {
        const id: UserContentId = `${uid}--${cid}`;
        const v = this.state.engagementRecord.get(id) || 0;
        this.state.engagementRecord.set(id, v + value);
    }

    private resetContentEngagement(uid: UserNodeId, cid: ContentNodeId) {
        const id: UserContentId = `${uid}--${cid}`;
        this.state.engagementRecord.delete(id);
    }

    private dwellActivity(uid: UserNodeId, cid: ContentNodeId, dwell: number, timestamp: number) {
        const value = dwellEngagement(dwell);
        this.increaseContentEngagement(uid, cid, value);
        this.broker.emit('activity', 'dwell', uid, cid, value, timestamp);
        this.broker.emit('activity-dwell', uid, cid, value, timestamp);
    }

    private commentActivity(uid: UserNodeId, cid: ContentNodeId, score: number, timestamp: number) {
        const value = commentEngagement(score);
        this.increaseContentEngagement(uid, cid, value);
        this.broker.emit('activity', 'comment', uid, cid, value, timestamp);
        this.broker.emit('activity-comment', uid, cid, value, timestamp);
    }

    public createEngagementEntry(uid: UserNodeId, cid: ContentNodeId) {
        const id: UserContentId = `${uid}--${cid}`;
        const v = this.state.engagementRecord.get(id) || 0;
        this.resetContentEngagement(uid, cid);
        this.addLogEntry(
            {
                id: cid,
                activity: 'engagement',
                value: v,
                timestamp: Date.now(),
            },
            uid
        );
    }

    public processLogEntry(data: LogEntry, id: UserNodeId, noEvent?: boolean) {
        const aid = id;
        const cid = (data.id || '') as ContentNodeId;

        switch (data.activity) {
            case 'dwell':
                this.dwellActivity(aid, cid, data.value || 0, data.timestamp);
                break;
            case 'comment':
                this.commentActivity(aid, cid, data.value || 0, data.timestamp);
                break;
            case 'engagement':
                this.broker.emit('activity', 'engagement', aid, cid, data.value || 0, data.timestamp);
                this.broker.emit('activity-engagement', aid, cid, data.value || 0, data.timestamp);
                break;
            default:
                this.increaseContentEngagement(aid, cid, activityEngagement(data.activity));
                this.broker.emit(
                    'activity',
                    data.activity,
                    aid,
                    cid,
                    activityEngagement(data.activity),
                    data.timestamp
                );
                this.broker.emit(
                    `activity-${data.activity}`,
                    aid,
                    cid,
                    activityEngagement(data.activity),
                    data.timestamp
                );
                break;
        }

        if (!noEvent) {
            this.broker.emit(`log-${aid}`);
            this.broker.emit(`logdata-${data.activity}`, aid, data);
        }
    }

    public addLogEntry(data: LogEntry, id: UserNodeId, noEvent?: boolean) {
        const aid = id;
        const logArray: LogEntry[] = this.state.logs.get(aid) || [];

        logArray.push(data);

        this.state.logs.set(aid, logArray);
        const logType = this.state.logsByType.get(data.activity);
        const logTypeA = logType || [];
        if (!logType) this.state.logsByType.set(data.activity, logTypeA);
        logTypeA.push({ user: aid, entry: data });

        this.processLogEntry(data, aid, noEvent);
    }

    public appendActionLog(data: LogEntry[], id: UserNodeId, noProcess?: boolean) {
        const aid = id;

        if (noProcess) {
            const logArray: LogEntry[] = this.state.logs.get(aid) || [];
            this.state.logs.set(aid, [...logArray, ...data]);
        } else {
            data.forEach((d) => {
                this.addLogEntry(d, aid, true);
            });
        }
        this.broker.emit(`log-${aid}`);
        data.forEach((d) => this.broker.emit(`logdata-${d.activity}`, aid, d));
    }

    public getActionLog(id: UserNodeId): LogEntry[] {
        const aid = id;
        return this.state.logs.get(aid) || [];
    }

    public getActionLogSince(timestamp: number, id: UserNodeId): LogEntry[] {
        const result: LogEntry[] = [];
        const log = this.getActionLog(id);

        for (let i = log.length - 1; i >= 0; --i) {
            if (log[i].timestamp > timestamp) {
                result.push(log[i]);
            } else {
                break;
            }
        }
        return result.reverse();
    }

    public getActionLogTypeSince(timestamp: number, type: LogActivity): UserLogEntry[] {
        const result: UserLogEntry[] = [];
        const log = this.state.logsByType.get(type) || [];

        for (let i = log.length - 1; i >= 0; --i) {
            if (log[i].entry.timestamp > timestamp) {
                result.push(log[i]);
            } else {
                break;
            }
        }
        return result.reverse();
    }

    public anonLogs() {
        this.state.logs.forEach((entry) => {
            entry.forEach((log) => {
                if (log.activity === 'comment') {
                    if (log.content) {
                        log.content = anonString(log.content);
                    }
                }
            });
        });
    }

    public sortLogs() {
        this.state.logsByType.forEach((log) => {
            log.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
        });
    }
}
