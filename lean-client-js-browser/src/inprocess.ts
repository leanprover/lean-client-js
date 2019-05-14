import * as BrowserFS from 'browserfs';
// import IndexedDBFileSystem from 'browserfs/dist/node/backend/IndexedDB';
import ZipFS from 'browserfs/dist/node/backend/ZipFS';
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
        conn.module = this.init(emscriptenInitialized);
        conn.module.catch((err) =>
            conn.error.fire({
                error: 'connect',
                message: `could not start emscripten version of lean: ${err}`,
            }));

        return conn;
    }

    private async init(emscriptenInitialized: Promise<{}>): Promise<any> {
        const [loadJs, inited, zipBuffer] = await Promise.all(
            [this.loadJs(), emscriptenInitialized, this.libraryZip]);
        if (this.libraryZip) {
            const libraryFS = await new Promise<ZipFS>((resolve, reject) =>
                ZipFS.Create({zipData: zipBuffer},
                    (err, res) => err ? reject(err) : resolve(res)));
            BrowserFS.initialize(libraryFS);
            const BFS = new BrowserFS.EmscriptenFS();
            Module.FS.createFolder(Module.FS.root, 'library', true, true);
            Module.FS.mount(BFS, {root: '/'}, '/library');
        }

        (Module.lean_init || Module._lean_init)();
        console.log('lean server initialized.');
        return Module;
    }
}

declare function lengthBytesUTF8(msg: string): number;
declare function stringToUTF8(msg: string, ptr: any, len: number);

class InProcessConnection implements Connection {
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();
    alive: boolean = true;

    module: Promise<any>;

    send(jsonMsg: any) {
        this.module.then((mod) => {
            const msg = JSON.stringify(jsonMsg);
            const len = (lengthBytesUTF8 || mod.lengthBytesUTF8)(msg) + 1;
            const msgPtr = mod._malloc(len);
            (stringToUTF8 || mod.stringToUTF8)(msg, msgPtr, len);
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
    return new Promise<Buffer>((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.responseType = 'arraybuffer';
        req.open('GET', url);
        req.onloadend = (e) => {
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

interface ResponseCacheHeaders {
    contentLength: string;
    etag: string;
    lastModified: string;
}
export function loadBufferFromURLCached(url: string): Promise<Buffer> {
    if (!url) {
        return null;
    }
    if (!url.toLowerCase().endsWith('.zip')) {
        return null;
    }
    if (!('indexedDB' in self)) {
        return loadBufferFromURL(url);
    }
    const filename = url.split('/').pop().split('.')[0];
    const headPromise = new Promise<ResponseCacheHeaders>((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.open('HEAD', url);
        req.onreadystatechange = (e) => {
            if (req.status === 200) {
                const responseData: ResponseCacheHeaders = {
                    contentLength: req.getResponseHeader('content-length'),
                    etag: req.getResponseHeader('etag'),
                    lastModified: req.getResponseHeader('last-modified'),
                };
                resolve(responseData);
            } else {
                reject(`could not fetch ${url}: http code ${req.status} ${req.statusText}`);
            }
        };
        req.onerror = (e) => reject(e);
        req.send();
    });

    const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const ver = 2;
        const dbRequest = indexedDB.open('leanlibrary', ver);
        dbRequest.onsuccess = (event) => {
            // console.log('opened indexedDB');
            resolve(dbRequest.result);
        };
        dbRequest.onerror = (event) => {
            console.log('failed to open indexedDB');
            reject(dbRequest.error);
        };
        dbRequest.onupgradeneeded = (event) => {
            const {result: db} = dbRequest;
            const arr = dbRequest.result.objectStoreNames;
            for (let j = 0; j < arr.length; j++) {
                db.deleteObjectStore(arr[j]);
            }
            // console.log('creating indexedDB');
            db.createObjectStore('library');
            db.createObjectStore('meta');
        };
    });

    const metaPromise = dbPromise.then((db) => new Promise<any>((resolve, reject) => {
        const trans = db.transaction('meta').objectStore('meta').get(filename);
        trans.onsuccess = (event) => {
            // console.log('retrieved header from cache', trans.result);
            resolve(trans.result);
        };
        trans.onerror = (event) => {
            console.log(`error getting header for ${filename} from cache`);
            reject(trans.error);
        };
    }));

    return Promise.all([headPromise, dbPromise, metaPromise])
        .then(([response, db, meta]) => {
            if (!meta || (meta.contentLength !== response.contentLength)
            || (meta.etag !== response.etag)
            || (meta.lastModified !== response.lastModified)) {
                // cache miss
                // console.log('cache miss!');
                const buffPromise = loadBufferFromURL(url);
                // assume that the file hasn't changed since head request...
                const metaUpdatePromise = new Promise<any>((res, rej) => {
                    // console.log('saving header to cache');
                    const trans = db.transaction('meta', 'readwrite').objectStore('meta')
                        .put(response, filename);
                    trans.onsuccess = (event) => {
                        // console.log('saved header to cache');
                        res(trans.result);
                    };
                    trans.onerror = (event) => {
                        console.log(`error saving header for ${filename} from cache`, event);
                        rej(trans.error);
                    };
                });
                return Promise.all([buffPromise, metaUpdatePromise])
                    .then(([buff, metaUpdate]) => {
                        return new Promise<Buffer>((res, rej) => {
                            // save buffer to cache
                            // console.log('saving library to cache');
                            const trans = db.transaction('library', 'readwrite').objectStore('library')
                                .put(buff, filename);
                            trans.onsuccess = (event) => {
                                // console.log('saved library to cache');
                                res(buff);
                            };
                            trans.onerror = (event) => {
                                console.log(`error saving ${filename} to cache`, event);
                                rej(trans.error);
                            };
                        });
                    });
            }
            // cache hit: pretend that the meta and library stores are always in sync
            return new Promise<Buffer>((res, rej) => {
                // console.log('cache hit!');
                const trans = db.transaction('library').objectStore('library')
                    .get(filename);
                trans.onsuccess = (event) => {
                    // console.log('retrieved library from cache', trans.result);
                    res(new Buffer(trans.result));
                };
                trans.onerror = (event) => {
                    console.log(`error getting ${filename} from cache`, event);
                    rej(trans.error);
                };
            });
        });
}

export class BrowserInProcessTransport extends InProcessTransport {
    constructor(opts: LeanJsOpts) {
        super(() => loadJsOrWasm(opts, loadJsBrowser), loadBufferFromURLCached(opts.libraryZip), opts.memoryMB || 256);
    }
}
