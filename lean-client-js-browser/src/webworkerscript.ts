import 'babel-polyfill';
import {Connection} from 'lean-client-js-core';
import {InProcessTransport, loadBufferFromURLCached, loadJsOrWasm} from './inprocess';
import {ErrorRes, Req, Res, StartWorkerReq} from './webworkertypes';
// could also get types from 'webworker' in tsconfig
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
                loadBufferFromURLCached(opts.libraryZip), opts.memoryMB || 256).connect();
            conn.jsonMessage.on((msg) => postMessage(msg));
            conn.error.on((error) => postMessage({response: 'webworker-error', error} as ErrorRes));
            break;

        default:
            if (conn) {
                conn.send(req);
            }
    }
};
