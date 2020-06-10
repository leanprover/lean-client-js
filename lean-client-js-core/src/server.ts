import {AdditionalMessageResponse, AllHoleCommandsRequest, AllHoleCommandsResponse, AllMessagesResponse,
    CheckingMode, CommandResponse, CompleteRequest, CompleteResponse, CurrentTasksResponse,
    ErrorResponse, FileRoi, HoleCommandsRequest, HoleCommandsResponse, HoleRequest, HoleResponse, InfoRequest,
    InfoResponse, Message, Request, RoiRequest, SearchRequest, SearchResponse, SyncRequest,
    WidgetEventRequest, WidgetEventResponse, GetWidgetRequest, GetWidgetResponse} from './commands';
import {Event} from './event';
import {Connection, Transport, TransportError} from './transport';

interface SentRequestInfo {
    resolve: (res: CommandResponse) => void;
    reject: (err: any) => void;
}

type SentRequestsMap = Map<number, SentRequestInfo>;

export interface UnrelatedError {
    error: 'unrelated';
    message: string;
}

export type ServerError = TransportError | UnrelatedError;

export class Server {
    jsonMessage: Event<any> = new Event();
    error: Event<ServerError> = new Event();
    allMessages: Event<AllMessagesResponse> = new Event();
    tasks: Event<CurrentTasksResponse> = new Event();

    logMessagesToConsole = false;

    private currentSeqNum: number = 0;
    private conn?: Connection;
    private currentMessages: Message[] = [];
    private sentRequests: SentRequestsMap = new Map();

    constructor(public transport: Transport) {
        this.jsonMessage.on((msg) => this.onMessage(msg));
    }

    connect() {
        this.conn = this.transport.connect();
        this.conn.jsonMessage.on((msg) => this.jsonMessage.fire(msg));
        this.conn.error.on((msg) => this.error.fire(msg));
    }

    // TODO(gabriel): restore roi & files on restart?
    restart() {
        this.dispose();
        this.connect();
    }

    send(req: InfoRequest): Promise<InfoResponse>;
    send(req: GetWidgetRequest): Promise<GetWidgetResponse>;
    send(req: WidgetEventRequest): Promise<WidgetEventResponse>;
    send(req: CompleteRequest): Promise<CompleteResponse>;
    send(req: SyncRequest): Promise<CommandResponse>;
    send(req: RoiRequest): Promise<CommandResponse>;
    send(req: Request): Promise<CommandResponse>;
    send(req: SearchRequest): Promise<SearchResponse>;
    send(req: HoleCommandsRequest): Promise<HoleCommandsResponse>;
    send(req: AllHoleCommandsRequest): Promise<AllHoleCommandsResponse>;
    send(req: HoleRequest): Promise<HoleResponse>;
    send(req: Request): Promise<CommandResponse> {
        if (!this.alive()) {
            return new Promise((resolve, reject) => reject('server is not alive'));
        }

        if (this.logMessagesToConsole) {
            console.log('=> server: ', req);
        }

        req.seq_num = this.currentSeqNum++;
        const promise = new Promise<CommandResponse>((resolve, reject) =>
            this.sentRequests.set(req.seq_num, { resolve, reject }));
        this.conn.send(req);
        return promise;
    }

    info(file: string, line: number, column: number): Promise<InfoResponse> {
        return this.send({command: 'info', file_name: file, line, column});
    }

    sync(file: string, contents: string): Promise<CommandResponse> {
        return this.send({command: 'sync', file_name: file, content: contents});
    }

    complete(file: string, line: number, column: number,
             skipCompletions?: boolean): Promise<CompleteResponse> {
        return this.send({command: 'complete', file_name: file, line, column,
            skip_completions: skipCompletions || false});
    }

    search(query: string): Promise<SearchResponse> {
        return this.send({command: 'search', query});
    }

    allHoleCommands(file: string): Promise<AllHoleCommandsResponse> {
        return this.send({command: 'all_hole_commands', file_name: file});
    }

    holeCommands(file: string, line: number, column: number): Promise<HoleCommandsResponse> {
        return this.send({command: 'hole_commands', file_name: file, line, column});
    }

    hole(file: string, line: number, column: number, action: string): Promise<HoleResponse> {
        return this.send({command: 'hole', file_name: file, line, column, action});
    }

    roi(mode: CheckingMode, files: FileRoi[]): Promise<CommandResponse> {
        return this.send({command: 'roi', files, mode} as RoiRequest);
    }

    alive(): boolean {
        return this.conn && this.conn.alive;
    }

    dispose() {
        if (this.conn) {
            this.conn.dispose();

            this.sentRequests.forEach((info, seqNum) => info.reject('disposed'));
            this.sentRequests.clear();
            this.currentSeqNum = 0;

            this.conn = null;
        }
    }

    /** Creates a Transport that utilises the same Connection as this server (but without seq_num clashes).
     * This is useful if you have a need for multiple `Server` objects using the same underlying lean process.
     * This happens, for example, in the vscode extension where there is a Server instance in the InfoView
     * and a Server instance in the extension.
     */
    makeProxyTransport(): Transport {
        return {
            connect : () => new ProxyConnection(this),
        };
    }

    private onMessage(msg: any) {
        if (this.logMessagesToConsole) {
            console.log('<= server: ', msg);
        }

        const reqInfo = this.sentRequests.get(msg.seq_num); // undefined if msg.seq_num does not exist
        if (reqInfo !== undefined) {
            this.sentRequests.delete(msg.seq_num);
            if (msg.response === 'ok') {
                reqInfo.resolve(msg);
            } else {
                reqInfo.reject(msg.message || msg);
            }
        } else if (msg.response === 'all_messages') {
            const allMsgRes = msg as AllMessagesResponse;
            this.currentMessages = allMsgRes.msgs;
            this.allMessages.fire(allMsgRes);
        } else if (msg.response === 'additional_message') {
            const addMsgRes = msg as AdditionalMessageResponse;
            this.currentMessages = this.currentMessages.concat([addMsgRes.msg]);
            this.allMessages.fire({
                response: 'all_messages',
                msgs: this.currentMessages,
            } as AllMessagesResponse);
        } else if (msg.response === 'current_tasks') {
            this.tasks.fire(msg);
        } else {
            // unrelated error
            this.error.fire({error: 'unrelated', message: msg.message || JSON.stringify(msg)});
        }
    }
}

export class ProxyConnection implements Connection {
    error: Event<TransportError> = new Event();
    jsonMessage: Event<any> = new Event();
    private subscriptions: Array<{dispose()}> = [];
    constructor(private parent: Server) {
        this.subscriptions.push(
            this.error,
            this.jsonMessage,
            this.parent.jsonMessage.on((x) => x.seq_num || this.jsonMessage.fire(x)),
            this.parent.error.on((x) =>
                this.error.fire(x.error == 'unrelated' ? { ...x, error: 'connect' } : x)),
        );
    }
    get alive() { return this.parent.alive(); }
    async send(jsonMsg: any) {
        const seq_num = jsonMsg.seq_num;
        try {
            const result = await this.parent.send(jsonMsg);
            this.jsonMessage.fire({ ...result, seq_num })
        } catch (msg) {
            const res: ErrorResponse = { response: 'error', message: msg, seq_num };
            this.jsonMessage.fire(res);
        }
    }
    dispose() {
        for (const s of this.subscriptions) {
            s.dispose();
        }
    }
}