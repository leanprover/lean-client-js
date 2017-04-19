import {Connection, Transport} from './transport';

declare const Module: any;

export class InProcessTransport implements Transport {
    private loadJs: () => Promise<any>;
    private memoryMB: number;

    constructor(loadJs: () => Promise<any>, memoryMB: number) {
        this.loadJs = loadJs;
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
            Module.lean_init();
            console.log('lean server initialized.');
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

// It seems that typescript cannot use the types for both DOM and webworkers...
declare const document: any;
declare const window: any;

export class BrowserInProcessTransport extends InProcessTransport {
    constructor(leanJsFile: string, memoryMB?: number) {
        super(() => new Promise((resolve, reject) => {
            window.onload = () => {
                const script = document.createElement('script');
                script.onload = resolve;
                script.src = leanJsFile;
                document.body.appendChild(script);
            };
        }), memoryMB || 256);
    }
}
