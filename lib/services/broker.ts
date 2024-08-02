import EE from 'eventemitter3';
import { ServiceEvents } from './events';

export default class ServiceBroker {
    private emitter = new EE();

    emit<TEventName extends keyof ServiceEvents & string>(
        eventName: TEventName,
        ...eventArg: ServiceEvents[TEventName]
    ) {
        this.emitter.emit(eventName, ...(eventArg as []));
    }

    on<TEventName extends keyof ServiceEvents & string>(
        eventName: TEventName,
        handler: (...eventArg: ServiceEvents[TEventName]) => void
    ) {
        this.emitter.on(eventName, handler);
    }

    off<TEventName extends keyof ServiceEvents & string>(
        eventName: TEventName,
        handler: (...eventArg: ServiceEvents[TEventName]) => void
    ) {
        this.emitter.off(eventName, handler);
    }
}

let broker: ServiceBroker;

export function getBroker(): ServiceBroker {
    if (!broker) {
        broker = new ServiceBroker();
    }
    return broker;
}
