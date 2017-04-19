import * as BrowserFS from 'browserfs';
import {ErrorResponse} from './commands';
import {Connection, Transport} from './transport';

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

    connect(onMessageReceived: (jsonMsg: any) => void): Connection {
        if ((self as any).Module) {
            throw new Error('cannot use more than one instance of InProcessTransport');
        }
        (self as any).Module = {};

        Module.noExitRuntime = true;
        Module.preRun = [ () => console.log('starting lean...') ];

        Module.print = (text: string) => {
            try {
                onMessageReceived(JSON.parse(text));
            } catch (e) {
                onMessageReceived({response: 'error', message: `Cannot parse: ${text}`});
            }
        };
        Module.printErr = (text: string) =>
            onMessageReceived({response: 'error', message: `stderr: ${text}`});

        Module.TOTAL_MEMORY = this.memoryMB * 1024 * 1024;

        console.log('downloading lean...');
        const module = this.loadJs().then(() => {
            if (this.libraryZip) {
                return this.libraryZip.then((zipBuffer) => {
                    const libraryFS = new BrowserFS.FileSystem.ZipFS(zipBuffer as any);
                    BrowserFS.initialize(libraryFS);
                    const BFS = new BrowserFS.EmscriptenFS();
                    Module.FS.createFolder(Module.FS.root, 'library', true, true);
                    Module.FS.mount(BFS, {root: '/'}, '/library');
                });
            }
        }).then(() => {
            Module.lean_init();
            console.log('lean server initialized.');
            return Module;
        });

        module.catch((err) =>
            onMessageReceived({
                response: 'error',
                message: `could not start emscripten version of lean: ${err}`,
            } as ErrorResponse));

        return new InProcessConnection(module);
    }
}

class InProcessConnection implements Connection {
    module: Promise<any>;

    constructor(module: Promise<any>) {
        this.module = module;
    }

    send(jsonMsg: any) {
        this.module.then((mod) => {
            const msg = JSON.stringify(jsonMsg);
            const len = mod.lengthBytesUTF8(msg) + 1;
            const msgPtr = mod._malloc(len);
            mod.stringToUTF8(msg, msgPtr, len);
            mod.lean_process_request(msgPtr);
            mod._free(msgPtr);
        });
    }

    close() {}
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

export class BrowserInProcessTransport extends InProcessTransport {
    constructor(leanJsFile: string, libraryZipFile: string, memoryMB?: number) {
        super(() => waitForBody().then(() => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.onload = resolve;
            script.src = leanJsFile;
            document.body.appendChild(script);
        })), loadBufferFromURL(libraryZipFile), memoryMB || 256);
    }
}

export function loadBufferFromURL(url: string): Promise<Buffer> {
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
