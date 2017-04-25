import {Connection, Event, Transport} from 'lean-client-js-core';

export class WebWorkerTransport implements Transport {
    leanJsFile: string;
    libraryZipFile: string;
    memoryMB: number;

    constructor(leanJsFile: string, libraryZipFile: string, memoryMB?: number) {
        this.leanJsFile = leanJsFile;
        this.libraryZipFile = libraryZipFile;
        this.memoryMB = memoryMB || 256;
    }

    connect(): WebWorkerConnection {
        const worker = new (require('worker-loader!./webworkerscript'))();
        worker.postMessage({
            command: 'start-webworker',
            memory: this.memoryMB,
            leanJsFile: this.leanJsFile,
            libraryZipFile: this.libraryZipFile,
        });
        const conn = new WebWorkerConnection(worker);
        worker.onmessage = (e) => {
            if (e.data.response === 'stderr') {
                conn.stderr.fire(e.data.chunk);
            } else {
                conn.jsonMessage.fire(e.data);
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

    close() {
        this.worker.terminate();
    }
}
