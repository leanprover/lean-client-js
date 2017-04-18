import {Transport, Connection} from './transport';

declare var Module: any;

export class InProcessTransport implements Transport {
    loadJs: () => Promise<any>;
    memoryMB: number;

    constructor(loadJs: () => Promise<any>, memoryMB: number) {
        this.loadJs = loadJs;
        this.memoryMB = memoryMB;
    }

    connect(onMessageReceived: (any) => void): Connection {
        if ((self as any).Module)
            throw `cannot use more than one instance of InProcessTransport`;
        (self as any).Module = {};

        Module.noExitRuntime = true;
        Module.preRun = [ () => console.log("starting lean...") ];

        Module.print = (text: string) => {
            try {
                onMessageReceived(JSON.parse(text))
            } catch (e) {
                onMessageReceived({'response': 'error', 'message': `Cannot parse: ${text}`})
            }
        }
        Module.printErr = (text: string) =>
            onMessageReceived({'response': 'error', 'message': `stderr: ${text}`});

        Module.TOTAL_MEMORY = this.memoryMB * 1024 * 1024;

        console.log("downloading lean...");
        let module = this.loadJs().then(() => {
            Module.lean_init();
            console.log("lean server initialized.");
            return Module;
        });

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
            let msg = JSON.stringify(jsonMsg);
            let len = mod.lengthBytesUTF8(msg) + 1;
            let msgPtr = mod._malloc(len);
            mod.stringToUTF8(msg, msgPtr, len);
            mod.lean_process_request(msgPtr);
            mod._free(msgPtr);
        });
    }

    close() {}
}

// It seems that typescript cannot use the types for both DOM and webworkers...
declare var document: any;
declare var window: any;

export class BrowserInProcessTransport extends InProcessTransport {
    constructor(leanJsFile: string, memoryMB?: number) {
        super(() => new Promise((resolve, reject) => {
            window.onload = () => {
                let script = document.createElement('script');
                script.onload = resolve;
                script.src = leanJsFile;
                document.body.appendChild(script);
            };
        }), memoryMB || 256);
    }
}