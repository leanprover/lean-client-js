import {Connection} from 'lean-client-js-core';
import {InProcessTransport, loadBufferFromURL} from './inprocess';

declare function importScripts(...urls: string[]): void;
declare function postMessage(message: any, transfer?: any[]): void;

let conn: Connection = null;

onmessage = (e) => {
    if (e.data.command === 'start-webworker') {
        const leanJsFile = e.data.leanJsFile as string;
        const libraryZipFile = e.data.libraryZipFile as string;
        const memory = e.data.memory as number;

        const loadJs = () => new Promise((resolve) => { importScripts(leanJsFile); resolve(); });

        conn = new InProcessTransport(loadJs, loadBufferFromURL(libraryZipFile), memory).connect();
        conn.jsonMessage.on((msg) => postMessage(msg));
        conn.stderr.on((chunk) => postMessage({response: 'stderr', chunk}));
    } else if (conn) {
        conn.send(e.data);
    }
};
