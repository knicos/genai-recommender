import { describe, it, beforeEach, vi } from 'vitest';
import { GraphService } from '../graph';
import ContentService from './contentService';
import ServiceBroker from '../broker';

describe('ContentService', () => {
    let broker = new ServiceBroker();
    let graph = new GraphService(broker);
    let service = new ContentService(broker, graph);
    beforeEach(() => {
        broker = new ServiceBroker();
        graph = new GraphService(broker);
        service = new ContentService(broker, graph);
    });

    describe('addContent', () => {
        it('adds new content', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            expect(service.hasContent('content:xyz')).toBe(true);
        });

        it('adds new content with labels', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [{ label: 'testlabel', weight: 1.0 }],
                id: 'xyz',
                author: 'TestAuthor',
            });

            expect(service.hasContent('content:xyz')).toBe(true);
            expect(graph.getEdgesOfType('topic', 'content:xyz')).toHaveLength(1);
        });

        it('posts content by author', async ({ expect }) => {
            const postFn = vi.fn();
            const userId = graph.addNode('user');

            broker.on('posted', postFn);

            service.postContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
                authorId: userId,
            });

            expect(service.hasContent('content:xyz')).toBe(true);
            expect(postFn).toHaveBeenCalledWith('content:xyz', userId);
            expect(graph.getEdge('author', 'content:xyz', userId)).toBeTruthy();
        });
    });

    describe('addContentData', () => {
        it('emits an update event', async ({ expect }) => {
            const meta = {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            };
            service.addContentMeta(meta);

            const eventFn = vi.fn();
            broker.on('contentupdate', eventFn);

            expect(service.hasContent('content:xyz')).toBe(true);

            service.addContentData('somedata', meta);
            expect(eventFn).toHaveBeenCalledWith('content:xyz');
        });

        it('can add low res data', async ({ expect }) => {
            const meta = {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            };
            service.addContentMeta(meta);

            expect(service.hasContent('content:xyz')).toBe(true);
            expect(service.getContentData('content:xyz')).toBeUndefined();
            service.addContentData({ normal: 'somedata', lowRes: 'lowres' }, meta);
            expect(service.getContentData('content:xyz')).toBe('somedata');
            expect(service.getContentData('content:xyz', true)).toBe('lowres');
        });
    });

    describe('addLabel', () => {
        it('emits a meta update event', async ({ expect }) => {
            const meta = {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            };
            service.addContentMeta(meta);

            const eventFn = vi.fn();
            broker.on('contentmeta', eventFn);

            service.addLabel('content:xyz', 'testlabel');
            expect(eventFn).toHaveBeenCalledWith('content:xyz');
            expect(meta.labels).toContainEqual({ label: 'testlabel', weight: 1 });
        });
    });

    describe('getContentData', () => {
        it('can get existing content data', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            expect(service.getContentData('content:xyz')).toBe('someurl');
        });

        it('returns undefined if there is no data', async ({ expect }) => {
            expect(service.getContentData('content:xyz')).toBeUndefined();
        });

        it('emits a missing event if no data', async ({ expect }) => {
            service.addContentMeta({
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            const eventFn = vi.fn();
            broker.on('contentmissing', eventFn);

            expect(service.getContentData('content:xyz')).toBe(undefined);
            expect(eventFn).toHaveBeenCalledWith('content:xyz');
        });
    });

    describe('activity events', () => {
        it('handles a like event', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            broker.emit('activity', 'like', 'user:1', 'content:xyz', 0.3, 100);

            expect(service.getContentStats('content:xyz')?.reactions).toBe(1);
        });

        it('handles a share event', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            broker.emit('activity', 'share_public', 'user:1', 'content:xyz', 0.3, 100);

            expect(service.getContentStats('content:xyz')?.shares).toBe(1);
        });

        it('handles an engagement event', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });

            broker.emit('activity', 'engagement', 'user:1', 'content:xyz', 0.3, 100);

            expect(service.getContentStats('content:xyz')?.engagement).toBe(0.3);
        });

        it('creates coengagements', async ({ expect }) => {
            service.addContent('someurl', {
                labels: [],
                id: 'xyz',
                author: 'TestAuthor',
            });
            service.addContent('someurl', {
                labels: [],
                id: 'www',
                author: 'TestAuthor',
            });

            broker.emit('activity', 'engagement', 'user:1', 'content:xyz', 0.3, 100);
            broker.emit('activity', 'engagement', 'user:1', 'content:www', 0.3, 100);

            const edge1 = graph.getEdge('coengaged', 'content:xyz', 'content:www');
            const edge2 = graph.getEdge('coengaged', 'content:www', 'content:xyz');
            expect(edge1).toBeTruthy();
            expect(edge2).toBeTruthy();
            expect(edge1?.weight).toBeGreaterThan(0);
            expect(edge2?.weight).toBeGreaterThan(0);
        });
    });
});
