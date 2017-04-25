import {Connection} from 'lean-client-js-core';
import {InProcessTransport, loadBufferFromURL, loadJsOrWasm} from './inprocess';
import {Req, Res, StartWorkerReq, StderrRes} from './webworkertypes';

declare function importScripts(...urls: string[]): void;
declare function postMessage(message: any, transfer?: any[]): void;

let conn: Connection = null;

onmessage = (e) => {
    const req = e.data as Req;
    switch (req.command) {
        case 'start-webworker':
            const opts = (req as StartWorkerReq).opts;

            const loadJs = (url) => new Promise((resolve) => { importScripts(url); resolve(); });

            conn = new InProcessTransport(() => loadJsOrWasm(opts, loadJs),
                loadBufferFromURL(opts.libraryZip), opts.memoryMB || 256).connect();
            conn.jsonMessage.on((msg) => postMessage(msg));
            conn.stderr.on((chunk) => postMessage({response: 'stderr', chunk}));
            break;

        default:
            if (conn) {
                conn.send(req);
            }
    }
};
