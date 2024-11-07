import { describe, it, vi } from 'vitest';
import ActionLogService from './actionlogService';
import ServiceBroker from '../broker';

describe('ActionLogService', () => {
    describe('addLogEntry', () => {
        it('generates a seen event', async ({ expect }) => {
            const broker = new ServiceBroker();
            const service = new ActionLogService(broker);

            const userEvent = vi.fn();
            broker.on('activity', userEvent);

            service.addLogEntry(
                {
                    activity: 'seen',
                    id: 'content:1',
                    timestamp: 100,
                },
                'user:1'
            );

            expect(userEvent).toHaveBeenCalledWith('seen', 'user:1', 'content:1', 0, 100);
        });

        it('generates a dwell event', async ({ expect }) => {
            const broker = new ServiceBroker();
            const service = new ActionLogService(broker);

            let dwell = 0;
            const userEvent = vi.fn((a, b, c, d) => {
                dwell = d;
            });
            broker.on('activity', userEvent);

            service.addLogEntry(
                {
                    activity: 'dwell',
                    id: 'content:1',
                    value: 4000,
                    timestamp: 100,
                },
                'user:1'
            );

            expect(userEvent).toHaveBeenCalledWith('dwell', 'user:1', 'content:1', expect.any(Number), 100);
            expect(dwell).toBeGreaterThan(0);
        });
    });

    describe('createEngagementEntry()', () => {
        it('triggers an activity event', async ({ expect }) => {
            const broker = new ServiceBroker();
            const service = new ActionLogService(broker);

            const eventFn = vi.fn();
            broker.on('activity-engagement', eventFn);
            service.addLogEntry(
                {
                    activity: 'seen',
                    id: 'content:1',
                    timestamp: 100,
                },
                'user:xyz'
            );
            service.addLogEntry(
                {
                    activity: 'dwell',
                    id: 'content:1',
                    value: 8000,
                    timestamp: 100,
                },
                'user:xyz'
            );
            service.createEngagementEntry('user:xyz', 'content:1');

            expect(eventFn).toHaveBeenCalledWith('user:xyz', 'content:1', expect.any(Number), expect.any(Number));
        });
    });

    describe('Action Logs.getActionLogSince', () => {
        it('only returns new items', async ({ expect }) => {
            const broker = new ServiceBroker();
            const service = new ActionLogService(broker);
            service.appendActionLog(
                [
                    { timestamp: 10, activity: 'like' },
                    { timestamp: 11, activity: 'like' },
                    { timestamp: 12, activity: 'like' },
                    { timestamp: 13, activity: 'like' },
                    { timestamp: 14, activity: 'like' },
                ],
                'user:xyz'
            );

            const results = service.getActionLogSince(12, 'user:xyz');

            expect(results).toHaveLength(2);
            expect(results[0].timestamp).toBe(13);
            expect(results[1].timestamp).toBe(14);
        });
    });

    describe('Action Logs.deleteLogs', () => {
        it('will remove all user logs', async ({ expect }) => {
            const broker = new ServiceBroker();
            const service = new ActionLogService(broker);
            service.addLogEntry({ timestamp: 10, activity: 'like' }, 'user:xyz');
            const l1 = service.getActionLog('user:xyz');
            expect(l1).toHaveLength(1);
            service.removeLogs('user:xyz');
            const l2 = service.getActionLog('user:xyz');
            expect(l2).toHaveLength(0);
        });
    });
});
