import {Connection, Event, Transport} from 'lean-client-js-core';
import {LeanJsOpts} from './inprocess';
import {Req, Res, StartWorkerReq, StderrRes} from './webworkertypes';

export class WebWorkerTransport implements Transport {
    opts: LeanJsOpts;

    constructor(opts: LeanJsOpts) {
        this.opts = opts;
    }

    connect(): WebWorkerConnection {
        const worker = new (require('worker-loader!./webworkerscript'))();
        worker.postMessage({
            command: 'start-webworker',
            opts: this.opts,
        } as StartWorkerReq);
        const conn = new WebWorkerConnection(worker);
        worker.onmessage = (e) => {
            const res = e.data as Res;
            switch (res.response) {
                case 'stderr': conn.stderr.fire((res as StderrRes).chunk); break;
                default: conn.jsonMessage.fire(e.data);
            }
        };
        return conn;
    }
}

export class WebWorkerConnection implements Connection {
    stderr: Event<string> = new Event();
    jsonMessage: Event<any> = new Event();

    worker: Worker;

    constructor(worker: Worker) {
        this.worker = worker;
    }

    send(msg: any) {
        this.worker.postMessage(msg);
    }

    dispose() {
        this.worker.terminate();
    }
}
