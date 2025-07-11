import ServiceBroker from '../broker';
import { ContentNodeId, GraphService, isContentID, isUserID, UserNodeId } from '../graph';
import { InternalUserProfile, ProfilingOptions, SimilarityOptions, UserNodeData } from './profilerTypes';
import { getTopicId } from '@base/helpers/topics';
import { buildUserProfile } from './builder';
import { anonUsername } from '@base/utils/anon';
import { createEmptyProfile } from './empty';
import { ContentService } from '../content';
import EmbeddingIndex from '@base/utils/indexer';
import { Embedding } from '@base/utils/embedding';
import { v4 as uuidv4 } from 'uuid';

const USER_KEY = 'genai_somekone_userID';

let userID: UserNodeId;

export function getCurrentUser(): UserNodeId {
    if (!userID) {
        userID = `user:${uuidv4()}`;
        window.sessionStorage.setItem(USER_KEY, userID);
    }
    return userID;
}

interface GlobalProfileStats {
    engagement: number;
}

type TopicEdgeTypes =
    | 'reacted_topic'
    | 'shared_topic'
    | 'followed_topic'
    | 'seen_topic'
    | 'viewed_topic'
    | 'commented_topic'
    | 'engaged_topic';

export default class ProfilerService {
    public readonly broker: ServiceBroker;
    public readonly graph: GraphService;
    public readonly content: ContentService;
    private options: ProfilingOptions = {};
    private userID?: UserNodeId;
    private internalProfiles = new Map<UserNodeId, InternalUserProfile>();
    private outOfDate = new Set<UserNodeId>();
    private globalStats: GlobalProfileStats = {
        engagement: 0,
    };
    private userIndex = new EmbeddingIndex<UserNodeId>();

    public coldStartThreshold = 10;

    constructor(broker: ServiceBroker, graph: GraphService, content: ContentService) {
        this.broker = broker;
        this.graph = graph;
        this.content = content;

        const sessionUserID = window.sessionStorage.getItem(USER_KEY);
        if (sessionUserID && isUserID(sessionUserID)) {
            this.userID = sessionUserID;
            this.graph.addNode('user', this.userID);
        } else {
            this.getCurrentUser();
        }

        this.broker.on('nodetype-user', (id) => this.processUserNodeChange(id as UserNodeId));
        this.broker.on('edgetype-engaged', (id) => {
            const uid = id as UserNodeId;
            if (this.internalProfiles.has(uid)) {
                this.triggerProfileEvent(uid);
            }
        });

        this.broker.on('edgetype-topic', (id) => {
            const uid = id as UserNodeId;
            if (this.internalProfiles.has(uid)) {
                this.triggerProfileEvent(uid);
            }
        });

        this.broker.on('activity-engagement', (id, content, value, timestamp) => {
            this.topicAffinity(id, 'engaged_topic', content, value, timestamp);
            this.contentAffinity(id, content, value, timestamp);
            this.updateEngagement(id, value);
        });

        this.broker.on('logdata-seen', (id, log) =>
            this.topicAffinity(id, 'seen_topic', log.id || 'content:', 1, log.timestamp)
        );

        this.broker.on('logdata-like', (id, log) =>
            this.topicAffinity(id, 'reacted_topic', log.id || 'content:', 1, log.timestamp)
        );

        this.broker.on('logdata-share_public', (id, log) =>
            this.topicAffinity(id, 'shared_topic', log.id || 'content:', 1, log.timestamp)
        );

        this.broker.on('logdata-follow', (id, log) => {
            this.topicAffinity(id, 'followed_topic', log.id || 'content:', 1, log.timestamp);
            if (log.id) {
                const contentMeta = this.content.getContentMetadata(log.id);
                const originUser = this.getUserData(id);
                if (originUser) {
                    originUser.followsCount += 1;
                }

                if (contentMeta?.authorId) {
                    const followedUser = this.getUserData(contentMeta.authorId);

                    if (followedUser) {
                        followedUser.followerCount += 1;
                    }
                }
            }
        });

        this.broker.on('logdata-comment', (id, log) =>
            this.topicAffinity(id, 'commented_topic', log.id || 'content:', 1, log.timestamp)
        );
    }

    private topicAffinity(
        id: UserNodeId,
        type: TopicEdgeTypes,
        content: ContentNodeId,
        value: number,
        timestamp: number
    ) {
        const topics = this.graph.getRelated('topic', content);
        topics.forEach((t) => {
            if (t.weight === 0) return;
            const edge = this.graph.getEdge(type, id, t.id);
            const score = (edge ? edge.weight : 0) + t.weight * value;
            this.graph.addEdge(type, id, t.id, score, timestamp);

            if (type === 'engaged_topic') {
                this.graph.addEdge('topic', id, t.id, score, timestamp);
                this.graph.addEdge('topic', t.id, id, score, timestamp);
            }
        });
    }

    private contentAffinity(id: UserNodeId, content: ContentNodeId, weight: number, timestamp: number) {
        this.graph.addOrAccumulateEdge('engaged', id, content, weight, timestamp);
        this.graph.addOrAccumulateEdge('engaged', content, id, weight, timestamp);
        //addOrAccumulateEdge('last_engaged', id, content, weight, timestamp);
    }

    private updateEngagement(id: UserNodeId, engagement: number) {
        const p = this.internalProfiles.get(id);
        if (p) {
            p.engagementTotal += engagement;
            p.seenItems++;
        }
    }

    private processUserNodeChange(id: UserNodeId) {
        const data = this.getUserData(id);
        if (data) {
            // Validate the data structure
            if (!data.embeddings) {
                const newData = { ...createEmptyProfile(id, 'NoName'), ...data };
                this.outOfDate.add(id);
                this.graph.updateNode(id, newData);
                return;
            }

            const hadProfile = this.internalProfiles.has(id);
            const oldProfile = this.internalProfiles.get(id) || {
                id,
                positiveRecommendations: 0,
                negativeRecommendations: 0,
                profile: data,
                seenItems: 0,
                engagementTotal: 0,
            };
            const oldData = oldProfile.profile;
            oldProfile.profile = data;
            this.internalProfiles.set(id, oldProfile);

            this.indexUser(id);

            this.globalStats.engagement = Math.max(this.globalStats.engagement, data.engagement || 0);

            if (oldData !== data || !hadProfile) {
                // Emit event, but it is not out-of-date.
                this.broker.emit(`profile-${id}`);
                this.broker.emit('profile', id);
            }
        } else {
            const newProfile = createEmptyProfile(id, 'NoName');
            this.outOfDate.add(id);
            this.graph.updateNode(id, newProfile);
        }
    }

    private triggerProfileEvent(id: UserNodeId) {
        const wasOOD = this.outOfDate.has(id);
        this.outOfDate.add(id);
        if (!wasOOD) {
            this.broker.emit(`profile-${id}`);
            this.broker.emit('profile', id);
        }
    }

    public setOptions(options: ProfilingOptions) {
        this.options = { ...options };
        this.internalProfiles.forEach((p) => {
            this.outOfDate.add(p.id);
        });
    }

    public reset() {
        this.internalProfiles.clear();
        this.outOfDate.clear();
        this.userID = undefined;
    }

    public removeProfile(id: UserNodeId) {
        this.internalProfiles.delete(id);
        this.outOfDate.delete(id);
        this.userIndex.remove(id);
        this.graph.removeNode(id);
    }

    public getUserData(id: UserNodeId) {
        return this.graph.getNodeData<UserNodeData>(id);
    }

    public getUserName(id: UserNodeId): string {
        const d = this.getUserData(id);
        return d ? d.name : '';
    }

    public setUserName(id: UserNodeId, name: string) {
        if (!this.graph.hasNode(id)) {
            this.graph.addNode('user', id, createEmptyProfile(id, name));
        } else {
            const data = this.getUserData(id);
            if (data) {
                data.name = name;
            } else {
                this.graph.updateNode(id, createEmptyProfile(id, name));
            }
        }
    }

    public setUser(id: UserNodeId) {
        this.graph.addNodeIfNotExists('user', id);
        this.userID = id;
        window.sessionStorage.setItem(USER_KEY, this.userID);
    }

    public newUser() {
        this.userID = this.graph.addNode('user');
        window.sessionStorage.setItem(USER_KEY, this.userID);
    }

    public getCurrentUser(): UserNodeId {
        if (!this.userID) {
            this.userID = this.graph.addNode('user');
            window.sessionStorage.setItem(USER_KEY, this.userID);
            userID = this.userID;
        }
        return this.userID;
    }

    public touchProfile(id: UserNodeId) {
        this.broker.emit(`profile-${id}`);
        this.broker.emit('profile', id);
    }

    public clearProfile(id: UserNodeId) {
        this.outOfDate.add(id);
        this.broker.emit(`profile-${id}`);
        this.broker.emit('profile', id);
    }

    public addUserProfile(id: UserNodeId, profile: UserNodeData) {
        const hadNode = this.graph.hasNode(id);

        if (hadNode) {
            if (this.internalProfiles.has(id)) {
                throw new Error('user_exists');
            }
        }

        this.graph.addNodeIfNotExists('user', id, profile);

        if (!hadNode) {
            // Ensure all the graph edges are also added.
            this.reverseProfile(id, profile);
        }
    }

    public reverseProfile(id: UserNodeId, profile: UserNodeData) {
        this.outOfDate.add(id);

        this.graph.addNodeIfNotExists('user', id);

        profile.affinities.contents.contents.forEach((c) => {
            const cid = isContentID(c.id) ? c.id : (`content:${c.id}` as ContentNodeId);
            this.graph.addEdge('engaged', id, cid, c.weight);
            this.graph.addEdge('engaged', cid, id, c.weight);
        });
        profile.affinities.topics.topics.forEach((t) => {
            this.graph.addEdge('topic', id, getTopicId(this.graph, t.label), t.weight);
            this.graph.addEdge('topic', getTopicId(this.graph, t.label), id, t.weight);
        });

        if ('engagement' in profile) {
            this.globalStats.engagement = Math.max(this.globalStats.engagement, profile.engagement);
        }

        this.outOfDate.delete(id);
        this.graph.updateNode(id, profile);

        //emitProfileEvent(id);
    }

    public replaceProfile(id: UserNodeId, profile: UserNodeData) {
        const user: InternalUserProfile = this.internalProfiles.get(id) || {
            profile,
            id,
            positiveRecommendations: 0,
            negativeRecommendations: 0,
            seenItems: 0,
            engagementTotal: 0,
        };
        user.profile = profile;
        this.internalProfiles.set(id, user);
        this.outOfDate.delete(id);
        this.broker.emit(`profile-${id}`);
        this.broker.emit('profile', id);
    }

    public createUserProfile(id: UserNodeId, name: string): UserNodeData {
        const profile = createEmptyProfile(id, name);
        this.addUserProfile(id, profile);
        return profile;
    }

    public getUserProfile(id?: UserNodeId): UserNodeData {
        const aid = id || this.getCurrentUser();
        const profile = this.internalProfiles.get(aid);

        if (profile && !this.outOfDate.has(aid)) {
            const cold = profile.engagementTotal / this.coldStartThreshold;
            profile.profile.cold = Math.max(0, 1 - cold * cold);
            return profile.profile;
        }

        if (!profile) {
            this.graph.updateNode(aid, createEmptyProfile(aid, 'NoName'));
        }

        const newProfile = buildUserProfile(this.graph, this.content, aid, this.getUserData(aid), this.options);

        // Calculate a coldness factor that should indicate how engaged the user is now.
        // A profile should also be cold to start with, reflecting a lack of profile data.
        const cold = profile ? profile.engagementTotal / this.coldStartThreshold : 0;
        newProfile.cold = Math.max(0, 1 - cold * cold);

        this.graph.touchNode(aid);
        this.outOfDate.delete(aid);
        this.userIndex.add(aid, newProfile.embeddings.taste);
        return newProfile;
    }

    public indexUser(id: UserNodeId) {
        this.userIndex.add(id, this.getUserProfile(id).embeddings.taste);
    }

    public getUserContent(id: UserNodeId, count?: number) {
        return this.graph.getRelated('author', id, { count, weightFn: (edge) => edge.timestamp }).map((r) => r.id);
    }

    public getSimilarUsers(embedding: Embedding, options?: SimilarityOptions) {
        // Force all profiles to be up-to-date
        if (this.outOfDate.size > 0) {
            this.outOfDate.forEach((u) => {
                try {
                    this.getUserProfile(u);
                } catch (e) {
                    console.error('Profile error', e);
                }
            });
            this.outOfDate.clear();
        }

        // TODO: Rebuild the index if the data type or algorithm changes.

        return this.userIndex.search(embedding, { count: options?.count });
    }

    public getAllUsers(): string[] {
        return this.graph.getNodesByType('user');
    }

    /*public updateEngagement(recommendation: ScoredRecommendation) {
        const weight = this.graph.getEdgeWeights('last_engaged', this.getCurrentUser(), recommendation.contentId)[0] || 0;
        appendActionLog([{ activity: 'engagement', id: recommendation.contentId, value: weight, timestamp: Date.now() }]);
    
        const profile = internalProfiles.get(getCurrentUser());
        if (profile) {
            trainProfile(recommendation, profile, weight);
        }
    }*/

    public getBestEngagement() {
        return this.globalStats.engagement;
    }

    public setBestEngagement(e: number) {
        this.globalStats.engagement = Math.max(this.globalStats.engagement, e);
    }

    public anonProfiles() {
        this.internalProfiles.forEach((user) => {
            user.profile.name = anonUsername();
        });
    }

    public getEngagedContent(id: UserNodeId, count?: number) {
        return this.graph.getRelated(
            'engaged',
            id,
            count ? { count, timeDecay: 0.1, period: 60 * 60 * 1000 } : undefined
        );
    }
}
