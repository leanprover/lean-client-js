export interface Request {
    command: string;
    seq_num?: number; // the sequence number is filled in automatically
}

export interface Response {
    response: string;
}

export type Severity = 'information' | 'warning' | 'error';

export interface Message {
    file_name: string;
    pos_line: number;
    pos_col: number;
    severity: Severity;
    caption: string;
    text: string;
}

export interface AllMessagesResponse extends Response {
    response: 'all_messages';
    msgs: Message[];
}

// Only used in Lean < 3.1.1
export interface AdditionalMessageResponse extends Response {
    response: 'additional_message';
    msg: Message;
}

export interface Task {
    file_name: string;
    pos_line: number;
    pos_col: number;
    end_pos_line: number;
    end_pos_col: number;
    desc: string;
}

export interface CurrentTasksResponse extends Response {
    response: 'current_tasks';
    is_running: boolean;
    cur_task?: Task;
    tasks: Task[];
}

export interface CommandResponse extends Response {
    response: 'ok';
    seq_num: number;
}

export interface ErrorResponse extends Response {
    response: 'error';
    seq_num?: number;
    message: string;
}

export interface SyncRequest extends Request {
    command: 'sync';
    file_name: string;
    content: string;
}

export interface CompleteRequest extends Request {
    command: 'complete';
    file_name: string;
    line: number;
    column: number;
    skip_completions?: boolean;
}

export interface CompletionCandidate {
    type?: string;
    tactic_params?: string[];
    text: string;
    doc?: string;
}

export interface CompleteResponse extends CommandResponse {
    prefix: string;
    completions: CompletionCandidate[];
}

export interface InfoRequest extends Request {
    command: 'info';
    file_name: string;
    line: number;
    column: number;
}

export interface InfoResponse extends CommandResponse {
    // TODO(gabriel)
}

export type CheckingMode = 'nothing' | 'visible-lines'
    | 'visible-lines-and-above' | 'visible-files' | 'open-files';

export interface RoiRange {
    begin_line: number;
    end_line: number;
}

export interface FileRoi {
    file_name: string;
    ranges: RoiRange[];
}

export interface RoiRequest extends Request {
    command: 'roi';
    mode: CheckingMode;
    files: FileRoi[];
}

export interface SleepRequest extends Request {
    command: 'sleep';
}

export interface LongSleepRequest extends Request {
    command: 'long_sleep';
}
