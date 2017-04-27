import {AdditionalMessageResponse, AllMessagesResponse, CommandResponse, CompleteRequest, CompleteResponse,
    CurrentTasksResponse, ErrorResponse, InfoRequest, InfoResponse, Message, Request, SyncRequest} from './commands';
import {Event} from './event';
import {Connection, Transport, TransportError} from './transport';

interface SentRequestInfo {
    resolve: (res: CommandResponse) => void;
    reject: (err: any) => void;
}

class SentRequestsMap { [seqNum: number]: SentRequestInfo }

export interface UnrelatedError {
    error: 'unrelated';
    message: string;
}

export type ServerError = TransportError | UnrelatedError;

export class Server {
    error: Event<ServerError> = new Event();
    allMessages: Event<AllMessagesResponse> = new Event();
    tasks: Event<CurrentTasksResponse> = new Event();

    private currentSeqNum: number = 0;
    private transport: Transport;
    private conn?: Connection;
    private currentMessages: Message[] = [];
    private sentRequests: SentRequestsMap = new SentRequestsMap();

    constructor(transport: Transport) {
        this.transport = transport;
    }

    connect() {
        this.conn = this.transport.connect();
        this.conn.jsonMessage.on((msg) => this.onMessage(msg));
        this.conn.error.on((msg) => this.error.fire(msg));
    }

    // TODO(gabriel): restore roi & files on restart?
    restart() {
        this.dispose();
        this.connect();
    }

    send(req: Request): Promise<CommandResponse> {
        req.seq_num = this.currentSeqNum++;
        const promise = new Promise((resolve, reject) =>
            this.sentRequests[req.seq_num] = { resolve, reject });
        this.conn.send(req);
        return promise;
    }

    sync(req: SyncRequest): Promise<CommandResponse> {
        return this.send(req);
    }

    info(req: InfoRequest): Promise<InfoResponse> {
        return this.send(req);
    }

    complete(req: CompleteRequest): Promise<CompleteResponse> {
        return this.send(req);
    }

    alive(): boolean {
        return this.conn && this.conn.alive;
    }

    dispose() {
        if (this.conn) {
            this.conn.dispose();
        }
    }

    private onMessage(msg: any) {
        const reqInfo = this.sentRequests[msg.seq_num]; // undefined if msg.seq_num does not exist
        if (reqInfo !== undefined) {
            delete this.sentRequests[msg.seq_num];
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
