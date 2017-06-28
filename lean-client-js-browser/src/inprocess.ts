import * as BrowserFS from 'browserfs';
import {Connection, Event, Transport, TransportError} from 'lean-client-js-core';

declare const Module: any;

export class InProcessTransport implements Transport {
    private loadJs: () => Promise<any>;
    private memoryMB: number;
    private libraryZip: Promise<Buffer>;

    constructor(loadJs: () => Promise<any>, libraryZip: Promise<Buffer>, memoryMB: number) {
        this.loadJs = loadJs;
        this.libraryZip = libraryZip;
        this.memoryMB = memoryMB;
    }

    connect(): Connection {
        if ((self as any).Module) {
            throw new Error('cannot use more than one instance of InProcessTransport');
        }
        (self as any).Module = {};

        Module.noExitRuntime = true;
        Module.preRun = [ () => console.log('starting lean...') ];

        const conn = new InProcessConnection();

        Module.print = (text: string) => {
            try {
                conn.jsonMessage.fire(JSON.parse(text));
            } catch (e) {
                conn.error.fire({error: 'connect', message: `cannot parse: ${text}`});
            }
        };
        Module.printErr = (text: string) => conn.error.fire({error: 'stderr', chunk: text});

        Module.TOTAL_MEMORY = this.memoryMB * 1024 * 1024;

        const emscriptenInitialized = new Promise((resolve, reject) => Module.onRuntimeInitialized = resolve);

        console.log('downloading lean...');
        conn.module = Promise.all([this.loadJs(), emscriptenInitialized, this.libraryZip]).then((results) => {
            if (this.libraryZip) {
                const zipBuffer = results[2];
                const libraryFS = new BrowserFS.FileSystem.ZipFS(zipBuffer);
                BrowserFS.initialize(libraryFS);
                const BFS = new BrowserFS.EmscriptenFS();
                Module.FS.createFolder(Module.FS.root, 'library', true, true);
                Module.FS.mount(BFS, {root: '/'}, '/library');
            }

            (Module.lean_init || Module._lean_init)();
            console.log('lean server initialized.');
            return Module;
        });

        conn.module.catch((err) =>
            conn.error.fire({
                error: 'connect',
                message: `could not start emscripten version of lean: ${err}`,
            }));

        return conn;
    }
}

class InProcessConnection implements Connection {
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();
    alive: boolean = true;

    module: Promise<any>;

    send(jsonMsg: any) {
        this.module.then((mod) => {
            const msg = JSON.stringify(jsonMsg);
            const len = mod.lengthBytesUTF8(msg) + 1;
            const msgPtr = mod._malloc(len);
            mod.stringToUTF8(msg, msgPtr, len);
            (mod.lean_process_request || mod._lean_process_request)(msgPtr);
            mod._free(msgPtr);
        });
    }

    dispose() {}
}

export interface LeanJsUrls {
    libraryZip?: string;

    javascript?: string;

    webassemblyWasm?: string;
    webassemblyJs?: string;
}

export interface LeanJsOpts extends LeanJsUrls {
    memoryMB?: number;
}

function waitForBody(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (document.body) {
            resolve();
        } else {
            window.onload = resolve;
        }
    });
}

export function loadJsBrowser(url: string): Promise<any> {
    return waitForBody().then(() => new Promise<any>((resolve, reject) => {
        const script = document.createElement('script');
        script.onload = resolve;
        script.src = url;
        document.body.appendChild(script);
    }));
}

export function loadJsOrWasm(urls: LeanJsUrls, loadJs: (url: string) => Promise<any>): Promise<any> {
    if ((self as any).WebAssembly && urls.webassemblyJs && urls.webassemblyWasm) {
        Module.wasmBinaryFile = urls.webassemblyWasm;
        return loadJs(urls.webassemblyJs);
    } else if (urls.javascript) {
        return loadJs(urls.javascript);
    } else {
        throw new Error(`cannot load lean.js from urls in ${urls}`);
    }
}

export function loadBufferFromURL(url: string): Promise<Buffer> {
    if (!url) {
        return null;
    }
    return new Promise<Buffer>((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.responseType = 'arraybuffer';
        req.open('GET', url);
        req.onload = (e) => {
            if (req.status === 200) {
                resolve(new Buffer(req.response as ArrayBuffer));
            } else {
                reject(`could not fetch ${url}: http code ${req.status} ${req.statusText}`);
            }
        };
        req.onerror = (e) => reject(e);
        req.send();
    });
}

export class BrowserInProcessTransport extends InProcessTransport {
    constructor(opts: LeanJsOpts) {
        super(() => loadJsOrWasm(opts, loadJsBrowser), loadBufferFromURL(opts.libraryZip), opts.memoryMB || 256);
    }
}
