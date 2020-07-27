import {Request, Response, TransportError} from 'lean-client-js-core';
import {LeanJsOpts} from './inprocesstypes';

export interface StartWorkerReq {
    command: 'start-webworker';
    opts: LeanJsOpts;
}

export type Req = StartWorkerReq | Request;

export interface ErrorRes {
    response: 'webworker-error';
    error: TransportError;
}

export type Res = ErrorRes | Response;
