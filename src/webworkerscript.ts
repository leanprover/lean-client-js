import {InProcessTransport} from './inprocess';
import {Connection} from './transport';

let conn: Connection = null;

onmessage = (e) => {
    if (e.data.command === 'start-webworker') {
        const leanJsFile = e.data.leanJsFile;
        const memory = e.data.memory;

        const loadJs = () => new Promise((resolve) => { importScripts(leanJsFile); resolve(); });

        conn = new InProcessTransport(loadJs, memory).connect((msg) => postMessage(msg));
    } else if (conn) {
        conn.send(e.data);
    }
};
