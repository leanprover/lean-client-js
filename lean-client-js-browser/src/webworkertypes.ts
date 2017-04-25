import {Request, Response} from 'lean-client-js-core';
import {LeanJsOpts} from './inprocess';

export interface StartWorkerReq {
    command: 'start-webworker';
    opts: LeanJsOpts;
}

export type Req = StartWorkerReq | Request;

export interface StderrRes {
    response: 'stderr';
    chunk: string;
}

export type Res = StderrRes | Response;
