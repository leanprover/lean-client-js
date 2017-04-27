import {Event} from './event';

export interface StderrError {
    error: 'stderr';
    chunk: string;
}

export interface ConnectError {
    error: 'connect';
    message: string;
    reason?: string;
}

export type TransportError = StderrError | ConnectError;

export interface Transport {
    connect(): Connection;
}

export interface Connection {
    error: Event<TransportError>;
    jsonMessage: Event<any>;

    alive: boolean;

    send(jsonMsg: any);
    dispose();
}
