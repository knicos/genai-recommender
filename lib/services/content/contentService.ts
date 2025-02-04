import { getTopicId } from '@base/helpers/topics';
import { ContentNodeId, GraphService, UserNodeId, WeightedNode } from '../graph';
import ContentState, { ContentData } from './state';
import { CommentEntry, ContentMetadata, ContentStats, ContentStatsId } from './contentTypes';
import { Embedding, embeddingSimilarity, normalise } from '@base/utils/embedding';
import { anonString } from '@base/utils/anon';
import MobileNetEmbedding from './mobilenet';
import AutoEncoder, { AutoEncoderOptions } from './autoencoder';
import ServiceBroker from '../broker';
import { LogActivity } from '../actionlogger/actionlogTypes';
import { engagementEmbedding } from './engagementEmbedding';

export interface CommentDataItem {
    content: ContentNodeId;
    comments: CommentEntry[];
}

export interface EncoderOptions extends AutoEncoderOptions {
    noEngagementFeatures?: boolean;
    noTagFeatures?: boolean;
    noContentFeatures?: boolean;
    epochs?: number;
    dims?: number;
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
            case 'share_public':
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

    private extractAllLabels() {
        const labelSet = new Set<string>();
        this.state.metaStore.forEach((m) => {
            m.labels.forEach((l) => {
                if (l.weight > 0) {
                    labelSet.add(l.label);
                }
            });
        });

        const labels = Array.from(labelSet);
        labels.sort();
        return labels;
    }

    private async generateFeatures(images: ContentNodeId[], opts?: EncoderOptions) {
        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }

        const imageData = images.map((i) => this.state.dataStore.get(i)?.normal || '');
        const fixedImages = images.filter((img) => !this.getContentMetadata(img)?.authorId);
        const engageFeatures: Embedding[] = opts?.noEngagementFeatures
            ? []
            : engagementEmbedding(this.graph, images, fixedImages);
        const contentFeatures: Embedding[] = opts?.noContentFeatures
            ? []
            : await this.mobilenet.generateEmbeddings(imageData);

        const labels = this.extractAllLabels();
        const labelFeatures: Embedding[] = opts?.noTagFeatures
            ? []
            : images.map((id) => {
                  const meta = this.getContentMetadata(id);
                  return labels.map((l) => ((meta?.labels || []).findIndex((v) => v.label === l) >= 0 ? 1 : 0));
              });

        const raw = images.map((_, i) => [
            ...(engageFeatures[i] || []),
            ...(contentFeatures[i] || []),
            ...(labelFeatures[i] || []),
        ]);

        return raw;
    }

    private async generateRawFeatures(image: string, tags: string[], opts?: EncoderOptions) {
        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }

        if (!opts?.noEngagementFeatures) {
            throw new Error('cannot_use_engagement');
        }

        const contentFeatures: Embedding = opts?.noContentFeatures
            ? []
            : (await this.mobilenet.generateEmbeddings([image]))[0];

        const labels = this.extractAllLabels();
        const labelFeatures: Embedding = opts?.noTagFeatures
            ? []
            : labels.map((l) => (tags.findIndex((v) => v === l) >= 0 ? 1 : 0));

        const raw: Embedding = [...contentFeatures, ...labelFeatures];

        return raw;
    }

    public async createEncoderModel(opts?: EncoderOptions): Promise<Blob | undefined> {
        const epochs = opts?.epochs || 200;

        const imageIds = Array.from(this.state.dataStore.keys());
        const raw = await this.generateFeatures(imageIds);

        if (opts?.onMobileNetDone) {
            opts.onMobileNetDone();
        }

        const inDim = raw[0].length;

        this.encoder = new AutoEncoder();
        this.encoder.metadata = opts || {};
        this.encoder.create(opts?.dims || 20, inDim, opts);

        const history = await this.encoder.train(raw, epochs, (e, logs) => {
            if (opts?.onEpoch) {
                opts.onEpoch(e, logs?.loss || 0, logs?.val_loss || 0);
            }
        });
        console.log('History', history);
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

    public getContentData(id: ContentNodeId, lowRes = false): string | undefined {
        const data = this.state.dataStore.get(id);
        if (!data && this.state.metaStore.has(id)) {
            this.broker.emit('contentmissing', id);
        }
        if (data) {
            if (lowRes) {
                return data.lowRes || data.normal;
            } else {
                return data.normal;
            }
        }
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

    async createEmbedding(id: ContentNodeId): Promise<Embedding> {
        if (!this.encoder) {
            throw new Error('no_autoencoder');
        }
        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }
        if (!this.encoder.metadata) {
            throw new Error('no_encoder_options');
        }

        const opts = this.encoder.metadata as EncoderOptions;

        const raw = await this.generateFeatures([id], opts);
        const embedding = this.encoder.generate(raw);
        return embedding[0];
    }

    async createIsolatedEmbedding(image: string, tags: string[]): Promise<Embedding> {
        if (!this.encoder) {
            throw new Error('no_autoencoder');
        }
        if (!this.mobilenet) {
            this.mobilenet = new MobileNetEmbedding();
        }
        if (!this.encoder.metadata) {
            throw new Error('no_encoder_options');
        }

        const opts = this.encoder.metadata as EncoderOptions;

        const raw = await this.generateRawFeatures(image, tags, opts);
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

            this.broker.emit('contentmeta', cid);
            this.broker.emit(`contentmeta-${cid}`);
        } catch (e) {
            console.warn(e);
        }
    }

    public addContentData(data: string | ContentData, meta: ContentMetadata) {
        const cid: ContentNodeId = `content:${meta.id}`;
        this.state.dataStore.set(cid, typeof data === 'string' ? { normal: data } : data);

        if (!meta.embedding) {
            this.createEmbedding(cid)
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

    public addContent(data: string | ContentData, meta: ContentMetadata) {
        this.addContentMeta(meta);
        this.addContentData(data, meta);
    }

    public getAllLabels(): string[] {
        const set = new Set<string>();
        this.state.metaStore.forEach((meta) => {
            meta.labels.forEach((l) => {
                set.add(l.label);
            });
        });
        return Array.from(set);
    }

    public addLabel(id: ContentNodeId, label: string, weight = 1) {
        const meta = this.getContentMetadata(id);
        if (meta) {
            const set = new Set(meta.labels.map((l) => l.label));
            if (!set.has(label)) {
                meta.labels.push({ label, weight });
                this.broker.emit('contentmeta', id);
                this.broker.emit(`contentmeta-${id}`);
            }
        }
    }

    public removeLabel(id: ContentNodeId, label: string) {
        const meta = this.getContentMetadata(id);
        if (meta) {
            const set = new Set(meta.labels.map((l) => l.label));
            if (set.has(label)) {
                meta.labels = meta.labels.filter((l) => l.label !== label);
                this.broker.emit('contentmeta', id);
                this.broker.emit(`contentmeta-${id}`);
            }
        }
    }

    public clearLabels(id: ContentNodeId) {
        const meta = this.getContentMetadata(id);
        if (meta) {
            meta.labels = [];
            this.broker.emit('contentmeta', id);
            this.broker.emit(`contentmeta-${id}`);
        }
    }

    public updateMeta(id: ContentNodeId, update: Partial<ContentMetadata>) {
        const meta = this.getContentMetadata(id);
        if (meta) {
            Object.assign(meta, update);
            this.broker.emit('contentmeta', id);
            this.broker.emit(`contentmeta-${id}`);
        }
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
        this.broker.emit('contentcomment', id);
        this.broker.emit(`contentcomment-${id}`);
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
        this.broker.emit('contentstats', id);
        this.broker.emit(`contentstats-${id}`);
    }

    public addContentEngagement(id: ContentNodeId, value: number) {
        const stats = this.state.statsStore.get(id) || createEmptyStats();
        stats.engagement += value;
        this.state.statsStore.set(id, stats);
        this.topEngagement = Math.max(this.topEngagement, stats.engagement);
        this.broker.emit('contentstats', id);
        this.broker.emit(`contentstats-${id}`);
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
        this.broker.emit('contentstats', id);
        this.broker.emit(`contentstats-${id}`);
    }

    public updateContentStats(stats: ContentStatsId[]) {
        stats.forEach((s) => {
            const old = this.state.statsStore.get(s.id) || createEmptyStats();
            old.reactions = Math.max(old.reactions, s.reactions);
            this.state.statsStore.set(s.id, s);
            this.broker.emit('contentstats', s.id);
            this.broker.emit(`contentstats-${s.id}`);
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
