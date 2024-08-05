export type ReplayEvents = {
    replaystart: [];
    replaystop: [];
    replaypaused: [];
    replayunpaused: [];
    replayfinished: [];
    replaystep: [time: number];
};
