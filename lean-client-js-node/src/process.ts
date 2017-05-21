import * as child from 'child_process';
import {Connection, Event, Transport, TransportError} from 'lean-client-js-core';
import * as readline from 'readline';

export class ProcessTransport implements Transport {
    executablePath: string;
    workingDirectory: string;
    options: string[];

    constructor(executablePath: string, workingDirectory: string, options: string[]) {
        this.executablePath = executablePath || 'lean';
        this.workingDirectory = workingDirectory;
        this.options = options;
    }

    connect(): Connection {
        const process = child.spawn(this.executablePath,
            ['--server'].concat(this.options).concat([`*${this.workingDirectory}*`]),
            { cwd: this.workingDirectory, env: this.getEnv() });
        const conn = new ProcessConnection(process);

        process.stderr.on('data', (chunk) => conn.error.fire({error: 'stderr', chunk: chunk.toString()}));
        readline.createInterface({
            input: process.stdout,
            terminal: false,
        }).on('line', (line) => {
             try {
                 conn.jsonMessage.fire(JSON.parse(line));
             } catch (e) {
                 conn.error.fire({error: 'connect', message: `cannot parse: ${line}`});
             }
        });

        process.on('error', (e) => {
            conn.alive = false;
            conn.error.fire({error: 'connect', reason: 'process-startup',
                message: `Unable to start the Lean server process: ${e}`});
        });

        process.on('exit', (code, signal) => {
            if (conn.alive) {
                conn.alive = false;
                const message = code ?
                    `Server has stopped with error code ${code}.` :
                    `Server has stopped due to signal ${signal}.`;
                conn.error.fire({error: 'connect', reason: 'process-exit', message});
            }
        });

        return conn;
    }

    getVersion(): string {
        const output = child.execSync(`${this.executablePath} --version`, { env : this.getEnv() });
        const matchRegex = /Lean \(version ([0-9.]+)/;
        return output.toString().match(matchRegex)[1];
    }

    private getEnv() {
        const env = Object.create(process.env);
        if (process.platform === 'win32') {
            // Note: on Windows the PATH variable must be set since
            // the standard msys2 installation paths are not added to the
            // Windows Path by msys2. We could instead people to set the
            // path themselves but it seems like a lot of extra friction.
            //
            // This is also tricky since there is very little way to give
            // feedback when shelling out to Lean fails. Node.js appears
            // fail to start without writing any output to standard error.
            //
            // For now we just set the path with low priority and invoke the process.

            const additionalPaths = [
                'C:\\msys64\\mingw64\\bin',
                'C:\\msys64\\usr\\local\\bin',
                'C:\\msys64\\usr\\bin',
                'C:\\msys64\\bin',
                'C:\\msys64\\opt\\bin',
            ];

            env.Path = env.Path + ';' + additionalPaths.join(';');
        }
        return env;
    }
}

export class ProcessConnection implements Connection {
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();

    process: child.ChildProcess;
    alive: boolean = true;

    constructor(process: child.ChildProcess) {
        this.process = process;
    }

    send(msg: any) {
        this.process.stdin.write(JSON.stringify(msg) + '\n');
    }

    dispose() {
        this.alive = false;
        this.process.kill();
    }
}
