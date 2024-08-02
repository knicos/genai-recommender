import { UserNodeId } from '../graph/graphTypes';

type ProfileEvent = {
    [key: `profile-${UserNodeId}`]: [];
};

type AnyProfileEvent = {
    profile: [id: UserNodeId];
};

export type ProfileEvents = ProfileEvent & AnyProfileEvent;
