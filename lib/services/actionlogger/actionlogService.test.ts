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
});
