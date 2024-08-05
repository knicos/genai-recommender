import { ActionLogService, LogEntry } from '../actionlogger';
import ServiceBroker from '../broker';
import { ContentService } from '../content';
import { UserNodeId } from '../graph';
import { ProfilerService, UserNodeData } from '../profiler';

const TIMESCALE = 200;

function firstTimestamp(actionLog: ActionLogService, users: UserNodeId[]) {
    let firstTS = Date.now();
    users.forEach((user) => {
        const logs = actionLog.getActionLog(user);
        firstTS = Math.min(firstTS, logs[0]?.timestamp || firstTS);
    });

    return firstTS;
}

function endTimestamp(actionLog: ActionLogService, users: UserNodeId[]) {
    let lastTS = 0;
    users.forEach((user) => {
        const logs = actionLog.getActionLog(user);
        lastTS = Math.max(lastTS, logs[logs.length - 1]?.timestamp || lastTS);
    });

    return lastTS;
}

export default class ReplayService {
    public readonly broker: ServiceBroker;
    public readonly content: ContentService;
    public readonly profiler: ProfilerService;
    public readonly actionLog: ActionLogService;
    private startTime = -1;
    private endTime = -1;
    private currentTime = -1;
    private indexes = new Map<UserNodeId, number>();
    private interval = -1;
    public speed = 1;
    private playing = false;
    private paused = false;

    constructor(profiler: ProfilerService, content: ContentService, actionLog: ActionLogService) {
        this.profiler = profiler;
        this.actionLog = actionLog;
        this.content = content;
        this.broker = profiler.broker;
    }

    public restart() {
        // Record user names
        const users = this.profiler.graph.getNodesByType('user');
        const data = new Map<UserNodeId, UserNodeData>();
        users.forEach((user) => {
            const d = this.profiler.getUserData(user);
            if (d) data.set(user, d);
        });

        // Delete all users and data
        this.profiler.graph.reset();
        this.profiler.reset();
        this.content.rebuildContent();

        // Re-add the users with their names
        users.forEach((user) => {
            if (this.actionLog.getActionLog(user)?.length > 0) {
                this.profiler.graph.addNode('user', user, { name: data.get(user)?.name });
            }
        });

        // Set the timestamps to begin
        this.startTime = firstTimestamp(this.actionLog, users);
        this.endTime = endTimestamp(this.actionLog, users);
        this.indexes.clear();
        this.currentTime = this.startTime;
    }

    private terminate() {
        if (this.interval >= 0) {
            clearTimeout(this.interval);
            this.interval = -1;
        }
        this.playing = false;
    }

    private step() {
        if (this.paused || !this.playing) return;

        this.currentTime += this.speed * TIMESCALE;

        const users = this.profiler.graph.getNodesByType('user');
        users.forEach((user) => {
            const startIx = this.indexes.get(user) || 0;
            const endIx = this.replayUserEntries(user, startIx, this.currentTime);
            this.indexes.set(user, endIx);
        });

        this.broker.emit('replaystep', this.currentTime);

        if (this.currentTime > this.endTime) {
            this.stop();
            this.broker.emit('replayfinished');
        }
    }

    private run() {
        this.terminate();
        this.interval = window.setInterval(() => {
            this.step();
        }, TIMESCALE);
        this.playing = true;
    }

    private replayEntry(id: UserNodeId, log: LogEntry) {
        /*if (log.activity === 'seen') {
            const profile = this.profiler.getUserProfile(id);
            const scores = scoreCandidates(
                id,
                [
                    {
                        contentId: log.id || 'content:none',
                        timestamp: log.timestamp,
                        candidateOrigin: 'topic_affinity',
                    },
                ],
                profile
            );
            cacheRecommendations.set(id + log.id, scores[0]);
        }*/
        this.actionLog.processLogEntry(log, id);

        /*if (log.activity === 'engagement') {
            const score = cacheRecommendations.get(id + log.id);
            if (score) {
                const weight = getEdgeWeights('last_engaged', id, score.contentId)[0] || 0;
                trainProfileById(id, score, weight);
            }
        }*/
    }

    private replayUserEntries(id: UserNodeId, index: number, end: number) {
        const logs = this.actionLog.getActionLog(id);
        let count = 0;
        for (let i = index; i < logs.length; ++i) {
            if (logs[i].timestamp <= end) {
                this.replayEntry(id, logs[i]);
                ++count;
            } else {
                return i;
            }
        }
        if (count > 0) this.profiler.clearProfile(id);
        return logs.length;
    }

    public start() {
        this.paused = false;
        this.restart();
        this.run();
        this.broker.emit('replaystart');
    }

    public pause() {
        this.paused = !this.paused;
        if (this.paused) {
            this.broker.emit('replaypaused');
        } else {
            this.broker.emit('replayunpaused');
        }
    }

    public stop() {
        this.terminate();
        this.broker.emit('replaystop');
    }

    public isPaused() {
        return this.playing && this.paused;
    }

    public isPlaying() {
        return this.playing;
    }

    public getTime() {
        return this.currentTime;
    }

    public getStartTime() {
        return this.startTime;
    }

    public getPosition() {
        if (this.playing && this.currentTime >= 0 && this.startTime >= 0) {
            return (this.currentTime - this.startTime) / (this.endTime - this.startTime);
        } else {
            return 0;
        }
    }
}
