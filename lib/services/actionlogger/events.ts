import { ContentNodeId, UserNodeId } from '../graph/graphTypes';
import { LogActivity, LogEntry } from './actionlogTypes';

type LogEvent = {
    [key: `log-${UserNodeId}`]: [];
};

type ActivityEvent = {
    activity: [type: LogActivity, user: UserNodeId, content: ContentNodeId, value: number, timestamp: number];
};

type ActivityTypeEvent = {
    [key in `activity-${LogActivity}`]: [user: UserNodeId, content: ContentNodeId, value: number, timestamp: number];
};

type LogDataEvent = {
    [key in `logdata-${LogActivity}`]: [id: UserNodeId, log: LogEntry];
};

export type LogEvents = LogEvent & LogDataEvent & ActivityEvent & ActivityTypeEvent;
