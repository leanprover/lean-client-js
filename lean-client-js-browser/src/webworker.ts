import {Connection, Event, Transport, TransportError} from 'lean-client-js-core';
import {LeanJsOpts} from './inprocesstypes';
import Worker from './webworkerscript';
import {Res, StartWorkerReq} from './webworkertypes';

export class WebWorkerTransport implements Transport {
    opts: LeanJsOpts;

    constructor(opts: LeanJsOpts) {
        this.opts = opts;
    }

    connect(): WebWorkerConnection {
        const worker = new Worker();
        worker.postMessage({
            command: 'start-webworker',
            opts: this.opts,
        } as StartWorkerReq);
        const conn = new WebWorkerConnection(worker);
        worker.onmessage = (e) => {
            const res = e.data as Res;
            conn.jsonMessage.fire(res);
            // switch (res.response) {
            //     case 'error': {
            //         conn.error.fire(res as any);
            //         break;
            //     }
            //     default: conn.jsonMessage.fire(res);
            // }
        };
        return conn;
    }
}

export class WebWorkerConnection implements Connection {
    // TODO: type issue here; not all errors are TransportErrors
    // try e.g. server.info() with a missing file
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();
    alive: boolean = true;

    worker: Worker;

    constructor(worker: Worker) {
        this.worker = worker;
    }

    send(msg: any) {
        this.worker.postMessage(msg);
    }

    dispose() {
        this.worker.terminate();
        this.alive = false;
    }
}
