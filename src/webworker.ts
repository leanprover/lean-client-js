import {Connection, Transport} from './transport';

export class WebWorkerTransport implements Transport {
    leanJsFile: string;
    libraryZipFile: string;
    memoryMB: number;

    constructor(leanJsFile: string, libraryZipFile: string, memoryMB?: number) {
        this.leanJsFile = leanJsFile;
        this.libraryZipFile = libraryZipFile;
        this.memoryMB = memoryMB || 256;
    }

    connect(onMessageReceived: (jsonMsg: any) => void): WebWorkerConnection {
        const worker = new (require('worker-loader!./webworkerscript'))();
        worker.postMessage({
            command: 'start-webworker',
            memory: this.memoryMB,
            leanJsFile: this.leanJsFile,
            libraryZipFile: this.libraryZipFile,
        });
        worker.onmessage = (e) => onMessageReceived(e.data);
        return new WebWorkerConnection(worker);
    }
}

export class WebWorkerConnection implements Connection {
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
