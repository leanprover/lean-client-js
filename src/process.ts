import * as child from 'child_process';
import * as readline from 'readline';
import {Connection, Transport} from './transport';

export class ProcessTransport implements Transport {
    executablePath: string;
    workingDirectory: string;
    options: string[];
    onStdErr: (chunk: string) => void;

    constructor(executablePath: string, workingDirectory: string, options: string[],
                onStdErr: (chunk: string) => void) {
        this.executablePath = executablePath || 'lean';
        this.workingDirectory = workingDirectory;
        this.options = options;
        this.onStdErr = onStdErr;
    }

    connect(onMessageReceived: (jsonMsg: any) => void): Connection {
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

        const process = child.spawn(this.executablePath, ['--server'].concat(this.options),
            { cwd: this.workingDirectory, env: this.getEnv() });
        process.stderr.on('data', (chunk) => this.onStdErr(chunk.toString()));
        readline.createInterface({
            input: process.stdout,
            terminal: false,
        }).on('line', (line) => {
             try {
                 onMessageReceived(JSON.parse(line));
             } catch (e) {
                 onMessageReceived({response: 'error', message: `cannot parse: ${line}`});
             }
        });

        return new ProcessConnection(process);
    }

    private getEnv() {
        const env = Object.create(process.env);
        if (process.platform === 'win32') {
            env.Path = env.Path + ';C:\\msys64\\mingw64\\bin;C:\\msys64\\usr\\local\\bin;'
            + 'C:\\msys64\\usr\\bin;C:\\msys64\\bin;C:\\msys64\\opt\\bin;';
        }
        return env;
    }
}

export class ProcessConnection implements Connection {
    process: child.ChildProcess;

    constructor(process: child.ChildProcess) {
        this.process = process;
    }

    send(msg: any) {
        this.process.stdin.write(JSON.stringify(msg) + '\n');
    }

    close() {
        this.process.kill();
    }
}
