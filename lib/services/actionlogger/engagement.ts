import { LogActivity, LogEntry } from './actionlogTypes';

const MIN_DWELL_TIME = 2000;
const MAX_DWELL_TIME = 10000;
const MAX_COMMENT_LENGTH = 80;

function normDwell(d: number): number {
    return Math.max(0, Math.min(10, (d - MIN_DWELL_TIME) / (MAX_DWELL_TIME - MIN_DWELL_TIME)));
}

const ACTIVITY_VALUES: { [key in LogActivity]: number } = {
    seen: 0,
    like: 0.1,
    unreact: -0.1,
    share_public: 0.5,
    dwell: 0.3,
    follow: 0.5,
    unfollow: -0.5,
    comment: 0.6,
    hide: -0.5,
    begin: NaN,
    end: NaN,
    engagement: NaN,
    hide_similar: NaN,
    inactive: NaN,
};

export function dwellEngagement(dwell: number) {
    return normDwell(dwell) * ACTIVITY_VALUES.dwell;
}

export function commentEngagement(score: number) {
    return Math.min(1, score / MAX_COMMENT_LENGTH) * ACTIVITY_VALUES.comment;
}

export function activityEngagement(activity: LogActivity) {
    return ACTIVITY_VALUES[activity];
}

export function engagementFromLog(log: LogEntry[]) {
    let sum = 0;
    log.forEach((l) => {
        switch (l.activity) {
            case 'engagement':
                return l.value || 0;
            case 'comment':
                sum += commentEngagement(l.value || 0);
                break;
            case 'dwell':
                sum += dwellEngagement(l.value || 0);
                break;
            case 'seen':
            case 'like':
            case 'unreact':
            case 'share_public':
            case 'follow':
            case 'unfollow':
            case 'hide':
                sum += activityEngagement(l.activity);
                break;
        }
    });

    return sum;
}
