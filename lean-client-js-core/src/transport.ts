import {Event} from './event';

export interface Transport {
    connect(): Connection;
}

export interface Connection {
    stderr: Event<string>;
    jsonMessage: Event<any>;

    send(jsonMsg: any);
    close();
}
