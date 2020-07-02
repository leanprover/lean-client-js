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
    end_pos_line?: number;
    end_pos_col?: number;
    severity: Severity;
    caption: string;
    text: string;
    widget?: WidgetIdentifier;
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

export interface GetWidgetRequest extends Request {
    command: 'get_widget';
    file_name: string;
    line: number;
    column: number;
    /** The widget root component id. */
    id: number;
}
export interface GetWidgetResponse extends CommandResponse {
    widget: WidgetData;
}

export interface InfoSource {
    line: number;
    column: number;
    file?: string;
}

export type GoalState = string;

export interface WidgetIdentifier {
    html?: WidgetComponent;
    line: number;
    column: number;
    /** The widget root component id. */
    id?: number;
}

export interface WidgetData extends WidgetIdentifier {
    html: WidgetComponent;
}

export interface InfoRecord {
    'full-id'?: string;
    text?: string;
    type?: string;
    doc?: string;
    source?: InfoSource;
    tactic_params?: string[];
    state?: GoalState;
    widget?: WidgetIdentifier;
}

export interface InfoResponse extends CommandResponse {
    record?: InfoRecord;
}

/** Experimental API, >=3.1.1 */
export interface SearchRequest extends Request {
    command: 'search';
    query: string;
}

export interface SearchItem {
    source?: InfoSource;
    text: string;
    type: string;
    doc?: string;
}

export interface SearchResponse extends CommandResponse {
    results: SearchItem[];
}

export interface HoleCommandsRequest extends Request {
    command: 'hole_commands';
    file_name: string;
    line: number;
    column: number;
}

export interface HoleCommandAction {
    name: string;
    description: string;
}

export interface HoleCommands {
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    results: HoleCommandAction[];
}

export interface HoleCommandsResponse extends CommandResponse, HoleCommands {}

export interface AllHoleCommandsRequest extends Request {
    command: 'all_hole_commands';
    file_name: string;
}

export interface AllHoleCommandsResponse extends CommandResponse {
    holes: HoleCommands[];
}

export interface HoleRequest extends Request {
    command: 'hole';
    file_name: string;
    line: number;
    column: number;
    action: string;
}

export interface HoleReplacementAlternative {
    code: string;
    description: string;
}

export interface HoleReplacements {
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
    alternatives: HoleReplacementAlternative[];
}

export interface HoleResponse extends CommandResponse {
    replacements?: HoleReplacements;
    message?: string;
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

export type WidgetEffect =
| {kind: 'insert_text'; text: string}
| {kind: 'reveal_position'; file_name: string; line: number; column: number}
| {kind: 'highlight_position'; file_name: string; line: number; column: number}
| {kind: 'clear_highlighting'}
| {kind: 'copy_text'; text:string}
| {kind: 'custom'; key: string; value: string}

export interface WidgetEventRecordSuccess {
    status: 'success';
    widget: WidgetData;
    effects?: WidgetEffect[];
}

/** 3.15 ≤ lean.version ≤ 3.16 */
export interface WidgetEventRecordEdit {
    status: 'edit';
    widget: WidgetData;
    /** Some text to insert after the widget's comma. */
    action: string;
}

export interface WidgetEventRecordInvalid {
    status: 'invalid_handler';
}
export interface WidgetEventRecordError {
    status: 'error';
    message: string;
}

export type WidgetEventRecord =
    | WidgetEventRecordSuccess
    | WidgetEventRecordInvalid
    | WidgetEventRecordEdit
    | WidgetEventRecordError;

export interface WidgetEventResponse extends CommandResponse {
    record: WidgetEventRecord;
}

export interface WidgetEventHandler {
    /** handler id */
    h: number;
    /** route */
    r: number[];
}

export interface WidgetElement {
    /** tag */
    t: string;
    /** children */
    c: WidgetHtml[];
    /** attributes */
    a?: { [k: string]: any };
    /** events */
    e: {
        'onClick'?: WidgetEventHandler;
        'onMouseEnter'?: WidgetEventHandler;
        'onMouseLeave'?: WidgetEventHandler;
    };
    /** tooltip */
    tt?: WidgetHtml;
}
export interface WidgetComponent {
    /** children */
    c: WidgetHtml[];
}
export type WidgetHtml =
    | WidgetComponent
    | string
    | WidgetElement
    | null;

export interface WidgetEventRequest extends Request {
    command: 'widget_event';
    kind: 'onClick' | 'onMouseEnter' | 'onMouseLeave' | 'onChange';
    handler: WidgetEventHandler;
    args: { type: 'unit' } | { type: 'string'; value: string };
    file_name: string;
    line: number;
    column: number;
    id?: number;
}
