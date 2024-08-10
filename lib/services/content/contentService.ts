import { getTopicId } from '@base/helpers/topics';
import { ContentNodeId, GraphService, UserNodeId, WeightedNode } from '../graph';
import ContentState from './state';
import { CommentEntry, ContentMetadata, ContentStats, ContentStatsId } from './contentTypes';
import { Embedding, embeddingSimilarity, normalise } from '@base/utils/embedding';
import { anonString } from '@base/utils/anon';
import MobileNetEmbedding from './mobilenet';
import AutoEncoder from './autoencoder';
import ServiceBroker from '../broker';
import { LogActivity } from '../actionlogger/actionlogTypes';

export interface CommentDataItem {
    content: ContentNodeId;
    comments: CommentEntry[];
}

export interface EncoderOptions {
    epochs?: number;
    dims?: number;
    layers?: number[];
    onEpoch?: (epoch: number, loss: number, validationLoss: number) => void;
    onTrained?: () => void;
    onMobileNetDone?: () => void;
    noSave?: boolean;
}

function createEmptyStats() {
    return { reactions: 0, shares: 0, views: 0, engagement: 0 };
}

export default class ContentService {
    public readonly graph: GraphService;
    public readonly broker: ServiceBroker;
    private state = new ContentState();
    private topEngagement = 0;
    private mobilenet?: MobileNetEmbedding;
    private encoder?: AutoEncoder;
    private engageLog = new Map<UserNodeId, WeightedNode<ContentNodeId>[]>();

    constructor(broker: ServiceBroker, graph: GraphService) {
        this.graph = graph;
        this.broker = broker;

        this.broker.on('activity', (type, user, content, value, timestamp) =>
            this.processActivity(type, user, content, value, timestamp)
        );
    }

    private processEngagement(content: ContentNodeId, user: UserNodeId, engagement: number, timestamp: number) {
        if (engagement > 0) {
            const elog = this.engageLog.get(user) || [];
            // Now add some co-engagement edges
            let w = 1;
            for (let i = elog.length - 1; i >= Math.max(0, elog.length - 6); --i) {
                if (content !== elog[i].id) {
                    // Average of the engagement scores weighted by distance in time
                    const avgWeight = ((elog[i].weight + engagement) / 2) * w;
                    this.graph.addOrAccumulateEdge('coengaged', content, elog[i].id, avgWeight, timestamp);
                    this.graph.addOrAccumulateEdge('coengaged', elog[i].id, content, avgWeight, timestamp);
                }
                w *= 0.9;
            }
            elog.push({ id: content, weight: engagement });
            this.engageLog.set(user, elog);
        }
    }

    private processActivity(
        type: LogActivity,
        user: UserNodeId,
        content: ContentNodeId,
        value: number,
        timestamp: number
    ) {
        switch (type) {
            case 'like':
                this.addContentReaction(content);
                break;
            case 'unreact':
                this.removeContentReaction(content);
                break;
            case 'share_friends':
            case 'share_public':
            case 'share_private':
                this.addContentShare(content);
                break;
            case 'engagement':
                this.addContentEngagement(content, value);
                this.processEngagement(content, user, value, timestamp);
                break;
        }
    }

    public reset() {
        for (const n of this.state.metaStore) {
            this.graph.removeNode(n[0]);
        }
        this.state.reset();
    }

    public async setEncoderModel(model: Blob | string) {
        let blob;
        if (model instanceof Blob) blob = model;
        else {
            const response = await fetch(model);
            blob = await response.blob();
        }

        this.encoder = new AutoEncoder();
        await this.encoder.load(blob);
    }

    public async createEncoderModel(opts?: EncoderOptions): Promise<Blob | undefined> {
        const epochs = opts?.epochs || 200;

        this.encoder = new AutoEncoder();
        this.encoder.create(opts?.dims || 20, 1280, opts?.layers || []);

        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }

        const images = Array.from(this.state.dataStore.values());
        const raw = await this.mobilenet.generateEmbeddings(images);
        if (opts?.onMobileNetDone) {
            opts.onMobileNetDone();
        }
        await this.encoder.train(raw, epochs, (e, logs) => {
            if (opts?.onEpoch) {
                opts.onEpoch(e, logs?.loss || 0, logs?.val_loss || 0);
            }
        });
        if (opts?.onTrained) {
            opts.onTrained();
        }

        // Replace all existing content embeddings
        const reduced = this.encoder.generate(raw);
        let i = 0;
        this.state.dataStore.forEach((_, k) => {
            const meta = this.state.metaStore.get(k);
            if (meta) {
                meta.embedding = normalise(reduced[i]);
            }
            ++i;
        });

        return !opts?.noSave ? this.encoder.save() : undefined;
    }

    public hasEncoder() {
        return !!this.encoder;
    }

    public getContentData(id: ContentNodeId) {
        const data = this.state.dataStore.get(id);
        if (!data && this.state.metaStore.has(id)) {
            this.broker.emit('contentmissing', id);
        }
        return data;
    }

    public getContentMetadata(id: ContentNodeId) {
        return this.state.metaStore.get(id);
    }

    public hasContent(id: ContentNodeId): boolean {
        return this.state.metaStore.has(id);
    }

    public rebuildContent() {
        this.state.metaStore.forEach((meta) => {
            try {
                const cid = this.graph.addNode('content', `content:${meta.id}`, {
                    author: meta.author,
                    caption: meta.caption,
                });

                meta.labels.forEach((l) => {
                    if (l.weight > 0) {
                        const tid = getTopicId(this.graph, l.label);
                        this.graph.addEdge('topic', cid, tid, l.weight);
                        this.graph.addEdge('content', tid, cid, l.weight);
                    }
                });
            } catch (e) {
                console.warn(e);
            }
        });
    }

    async createEmbedding(data: string | HTMLCanvasElement): Promise<Embedding> {
        if (!this.encoder) {
            throw new Error('no_autoencoder');
        }
        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }
        const raw = await this.mobilenet.generateEmbedding(data);
        const embedding = this.encoder.generate([raw]);
        return embedding[0];
    }

    public addContentMeta(meta: ContentMetadata) {
        this.state.metaStore.set(`content:${meta.id}`, meta);

        if (meta.embedding) {
            // Ensure this since we rely on it.
            meta.embedding = normalise(meta.embedding);
        } else {
            console.error('No content embedding');
        }

        try {
            const cid = this.graph.addNode('content', `content:${meta.id}`, {
                author: meta.author,
                caption: meta.caption,
            });
            meta.labels.forEach((l) => {
                if (l.weight > 0) {
                    const tid = getTopicId(this.graph, l.label);
                    this.graph.addEdge('topic', cid, tid, l.weight);
                    this.graph.addEdge('content', tid, cid, l.weight);
                }
            });

            if (meta.authorId) {
                this.graph.addEdge('author', meta.authorId, cid);
                this.graph.addEdge('author', cid, meta.authorId);
            }
        } catch (e) {
            console.warn(e);
        }
    }

    public addContentData(data: string, meta: ContentMetadata) {
        const cid: ContentNodeId = `content:${meta.id}`;
        this.state.dataStore.set(cid, data);

        if (!meta.embedding) {
            this.createEmbedding(data)
                .then((e) => {
                    meta.embedding = normalise(e);
                })
                .catch((e) => {
                    console.error(e);
                });
        }

        if (!this.hasContent(cid)) {
            this.addContentMeta(meta);
        }

        this.broker.emit('contentupdate', cid);
        this.broker.emit(`contentupdate-${cid}`);
    }

    public addContent(data: string, meta: ContentMetadata) {
        this.addContentMeta(meta);
        this.addContentData(data, meta);
    }

    public postContent(data: string, meta: ContentMetadata) {
        this.addContent(data, meta);
        if (meta.authorId) {
            const cid: ContentNodeId = `content:${meta.id}`;
            this.broker.emit('posted', cid, meta.authorId);
        }
    }

    public removeContent(id: ContentNodeId) {
        this.state.dataStore.delete(id);
        this.state.metaStore.delete(id);
        this.graph.removeNode(id);
    }

    public addComment(id: ContentNodeId, user: UserNodeId, comment: string, ts: number) {
        const comments = this.state.commentStore.get(id) || [];
        comments.push({ userId: user, comment, timestamp: ts });
        comments.sort((a, b) => b.timestamp - a.timestamp);
        this.state.commentStore.set(id, comments);
    }

    public removeCommentsBy(id: UserNodeId) {
        this.state.commentStore.forEach((comment, key) => {
            this.state.commentStore.set(
                key,
                comment.filter((c) => c.userId !== id)
            );
        });
    }

    public anonComments() {
        this.state.commentStore.forEach((item) => {
            item.forEach((comment) => {
                comment.comment = anonString(comment.comment);
            });
        });
    }

    public getComments(id: ContentNodeId): CommentEntry[] {
        return this.state.commentStore.get(id) || [];
    }

    public dumpComments(): CommentDataItem[] {
        const result: CommentDataItem[] = [];
        this.state.commentStore.forEach((value, key) => {
            result.push({ content: key, comments: value });
        });

        return result;
    }

    public addContentReaction(id: ContentNodeId) {
        const stats = this.state.statsStore.get(id) || createEmptyStats();
        stats.reactions += 1;
        this.state.statsStore.set(id, stats);
    }

    public addContentEngagement(id: ContentNodeId, value: number) {
        const stats = this.state.statsStore.get(id) || createEmptyStats();
        stats.engagement += value;
        this.state.statsStore.set(id, stats);
        this.topEngagement = Math.max(this.topEngagement, stats.engagement);
    }

    public getMaxContentEngagement() {
        return this.topEngagement;
    }

    public removeContentReaction(id: ContentNodeId) {
        const stats = this.state.statsStore.get(id) || createEmptyStats();
        stats.reactions -= 1;
        this.state.statsStore.set(id, stats);
    }

    public addContentShare(id: ContentNodeId) {
        const stats = this.state.statsStore.get(id) || createEmptyStats();
        stats.shares += 1;
        this.state.statsStore.set(id, stats);
    }

    public updateContentStats(stats: ContentStatsId[]) {
        stats.forEach((s) => {
            const old = this.state.statsStore.get(s.id) || createEmptyStats();
            old.reactions = Math.max(old.reactions, s.reactions);
            this.state.statsStore.set(s.id, s);
        });
    }

    public getContentStats(id: ContentNodeId[]): ContentStats[];
    public getContentStats(id: ContentNodeId): ContentStats;
    public getContentStats(id: ContentNodeId | ContentNodeId[]): ContentStats | ContentStats[] {
        if (Array.isArray(id)) {
            return id.map((i) => ({ id: i, ...(this.state.statsStore.get(i) || createEmptyStats()) }));
        } else {
            return this.state.statsStore.get(id) || createEmptyStats();
        }
    }

    public getContentEngagement(id: ContentNodeId) {
        return this.getContentStats(id)?.engagement || 0;
    }

    public getAllContent() {
        return this.graph.getNodesByType('content');
    }

    public getSimilarContent(embedding: Embedding, count?: number, nodes?: ContentNodeId[]) {
        const anodes = nodes || this.getAllContent();

        const sims: WeightedNode<ContentNodeId>[] = [];
        anodes.forEach((n) => {
            const meta = this.getContentMetadata(n);
            if (meta && meta.embedding) {
                const sim = embeddingSimilarity(embedding, meta.embedding);
                sims.push({ id: n, weight: sim });
            }
        });

        sims.sort((a, b) => b.weight - a.weight);
        return count ? sims.slice(0, count) : sims;
    }

    public getEngagedUsers(id: ContentNodeId, count?: number) {
        return this.graph.getRelated(
            'engaged',
            id,
            count ? { count, timeDecay: 0.1, period: 60 * 60 * 1000 } : undefined
        );
    }

    public getCoengagedContent(id: ContentNodeId, count?: number) {
        return this.graph.getRelated('coengaged', id, count ? { count } : undefined);
    }
}
