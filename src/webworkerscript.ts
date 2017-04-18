import {InProcessTransport} from './inprocess';
import {Connection} from './transport';

let conn: Connection = null;

onmessage = (e) => {
    if (e.data.command == 'start-webworker') {
        let leanJsFile = e.data.leanJsFile;
        let memory = e.data.memory;

        let loadJs = () => new Promise((resolve) => { importScripts(leanJsFile); resolve() });

        conn = new InProcessTransport(loadJs, memory).connect((msg) => postMessage(msg));
    } else if (conn) {
        conn.send(e.data);
    }
}