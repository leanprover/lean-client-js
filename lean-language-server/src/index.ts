#!/usr/bin/env node
import { ProcessTransport, Server, Severity } from 'lean-client-js-node';
import {
    CompletionItem,
    CompletionItemKind,
    Definition,
    Diagnostic,
    DiagnosticSeverity,
    Hover,
    InitializeResult,
    Location,
    MarkedString,
    Position,
    Range,
    SymbolInformation,
    SymbolKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    TextDocuments,
    createConnection,
    VersionedTextDocumentIdentifier,
    WorkspaceSymbolParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

const connection = createConnection();

const server = new Server(null);

server.error.on((err) => {
    switch (err.error) {
        case 'stderr':
            connection.console.log(err.chunk);
            break;
        case 'connect':
            connection.window.showErrorMessage(err.message);
            break;
        case 'unrelated':
            connection.tracer.log(err.message);
            break;
    }
});

const documents = new TextDocuments(TextDocument);
documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
    const extraArgs = process.argv.indexOf('--');
    const argv = extraArgs === -1 ? [] : process.argv.slice(extraArgs + 1)
    server.transport = new ProcessTransport('lean', params.rootPath, argv);
    server.connect();
    sendRoi();
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Full,
            completionProvider: {},
            definitionProvider: true,
            hoverProvider: true,
            workspaceSymbolProvider: true,
        },
    };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    server.sync(URI.parse(change.document.uri).fsPath, change.document.getText());
});

function sendRoi() {
    server.roi('visible-files',
        documents.keys().map((uri) =>
            ({file_name: URI.parse(uri).fsPath,
              ranges: [{begin_line: 0, end_line: Math.pow(2, 31)}]})));
}

documents.onDidOpen(() => sendRoi());
documents.onDidClose(() => sendRoi());

// // The settings interface describe the server relevant settings part
// interface Settings {
//     languageServerExample: ExampleSettings;
// }

// // These are the example settings we defined in the client's package.json
// // file
// interface ExampleSettings {
//     maxNumberOfProblems: number;
// }

// hold the maxNumberOfProblems setting
// let maxNumberOfProblems: number;
// // The settings have changed. Is send on server activation
// // as well.
// connection.onDidChangeConfiguration((change) => {
//     const settings =  change.settings as Settings;
//     maxNumberOfProblems = settings.languageServerExample.maxNumberOfProblems || 100;
//     // Revalidate any open text documents
//     documents.all().forEach(validateTextDocument);
// });

function toSeverity(severity: Severity): DiagnosticSeverity {
    if (severity === 'warning') {
        return DiagnosticSeverity.Warning;
    } else if (severity === 'error') {
        return DiagnosticSeverity.Error;
    } else if (severity === 'information') {
        return DiagnosticSeverity.Information;
    }
}

server.allMessages.on((messages) => {
    const diagnosticMap: Map<string, Diagnostic[]> = new Map();
    for (const uri of documents.keys()) {
        diagnosticMap.set(uri, []);
    }

    for (const message of messages.msgs) {
        const start_line = Math.max(message.pos_line - 1, 0);
        const end_line = Math.max(message.end_pos_line - 1, 0);
        const start_pos = Position.create(start_line, message.pos_col)
        const end_pos = message.end_pos_col !== undefined
            ? Position.create(end_line, message.end_pos_col)
            : start_pos
        const range = Range.create(start_pos, end_pos);
        const diagnostics = diagnosticMap.get(URI.file(message.file_name).toString());
        if (diagnostics) {
            diagnostics.push({
                range,
                message: message.text,
                severity: toSeverity(message.severity),
            });
        }
    }
    diagnosticMap.forEach((diagnostics, uri) => {
        connection.sendDiagnostics({uri, diagnostics});
    });
});

export interface LeanFileProgressProcessingInfo {
    /** Range which is still being processed */
    range: Range;
}
export interface LeanFileProgressParams {
    /** The text document to which this progress notification applies. */
    textDocument: VersionedTextDocumentIdentifier;
    /**
     * Array containing the parts of the file which are still being processed.
     * The array should be empty if and only if the server is finished processing.
     */
    processing: LeanFileProgressProcessingInfo[];
}

let filesInProgress: string[] = [];
server.tasks.on((tasks) => {
    const newProgress: {[fileName: string]: LeanFileProgressProcessingInfo[]} = {};
    for (const task of tasks.tasks) {
        newProgress[task.file_name] ||= [];
        newProgress[task.file_name].push({
            range: Range.create(Position.create(task.pos_line-1, task.pos_col),
                Position.create(task.end_pos_line-1, task.end_pos_col)),
        });
    }

    for (const oldFile of filesInProgress) {
        newProgress[oldFile] ||= [];
    }

    filesInProgress = [];
    for (const fileName in newProgress) {
        if (newProgress[fileName].length) {
            filesInProgress.push(fileName);
        }
        const params: LeanFileProgressParams = {
            textDocument: {version: 0, uri: URI.file(fileName).toString()},
            processing: newProgress[fileName],
        };
        connection.sendNotification('$/lean/fileProgress', params);
    }
})

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const fileName = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
    const position = textDocumentPosition.position;
    return server.complete(fileName, position.line + 1, position.character).then((message) => {
        return !message.completions ? [] : message.completions.map((completion) => {
            const item: CompletionItem = {
                label: completion.text,
                kind: CompletionItemKind.Function,
                documentation: completion.doc,
                detail: completion.tactic_params ?
                    completion.tactic_params.join(' ') :
                    completion.type,
            };
            // item.range = new vscode.Range(position.translate(0, -message.prefix.length), position);
            if (completion.tactic_params) {
                item.detail = completion.tactic_params.join(' ');
            } else {
                item.detail = completion.type;
            }
            item.documentation = completion.doc;
            return item;
        });
    });
});

connection.onDefinition(((params): Promise<Definition[]> => {
    const fileName = URI.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    return server.info(fileName, position.line + 1, position.character).then((response) => {
        if (response.record && response.record.source) {
            const src = response.record.source;
            const uri = src.file ? URI.file(src.file).toString() : params.textDocument.uri;
            const pos = Position.create(src.line - 1, src.column);
            return [Location.create(uri, Range.create(pos, pos))];
        } else {
            return [];
        }
    });
}) as any);

connection.onHover((params): Promise<Hover> => {
    const fileName = URI.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    return server.info(fileName, position.line + 1, position.character).then((response) => {
        const record = response.record;
        if (!record) {
            return {contents: []};
        }

        const marked: MarkedString[] = [];
        const name = record['full-id'] || record.text;
        if (name) {
            if (response.record.tactic_params) {
                marked.push({
                    language: 'text',
                    value: name + ' ' + record.tactic_params.join(' '),
                });
            } else {
                marked.push({
                    language: 'lean',
                    value: name + ' : ' + record.type,
                });
            }
        }
        if (response.record.doc) {
            marked.push(response.record.doc);
        }
        return {
            contents: marked,
            range: Range.create(position, position),
        } as Hover;
    });
});

connection.onWorkspaceSymbol(async (params: WorkspaceSymbolParams): Promise<SymbolInformation[]> => {
        const response = await server.search(params.query);
        return response.results
            .filter((item) => item.source && item.source.file &&
                item.source.line && item.source.column)
            .map((item) => {
                const loc = {
                    uri: URI.file(item.source.file).toString(),
                    range: Range.create(
                        Position.create(item.source.line - 1, item.source.column),
                        Position.create(item.source.line - 1, item.source.column + 1),
                    )
                }
                return {
                    name: item.text,
                    kind: SymbolKind.Function,
                    type: item.type,
                    location: loc};
                });
    }
)

/* See https://github.com/leanprover/lean4/blob/f1b4d9a1930b530ae4ace1247b0b1324128e277c/src/Lean/Data/Lsp/Extra.lean#L55-L58
 */
interface PlainGoalResponse {
  rendered: '';
  goals: String[];
}

function upconvertToLean4PlainGoal(goalState: String): PlainGoalResponse {
    // strip 'N goals' from the front (which is present for 0 or 2+ goals)
    if (goalState === 'no goals') { return { rendered: '', goals: [] } };
    const withoutCount = goalState.replace(/^\d+ goals?\n/, '');
    const goals = withoutCount.split(/(?<=^⊢ [^]*?\n)\n/m)
    return {rendered: '', goals: goals.map(each => each.trim())};
}

connection.onRequest('$/lean/plainGoal', async params => {
    const fileName = URI.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    return server.info(fileName, position.line + 1, position.character).then((response) => {
        const record = response.record;
        if (!record || !record.state) { return {}; }
        return upconvertToLean4PlainGoal(record.state.trim());
    });
});

connection.onRequest('$/lean/discoverWidget', async params => {
    const fileName = URI.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    const info = await server.info(
        fileName, position.line + 1, position.character,
    );
    if (!info.record || !info.record.widget) { return {}; }
    const widget_info = info.record.widget;
    const widget = await server.send({
        command: 'get_widget',
        file_name: fileName,
        line: widget_info.line,
        column: widget_info.column,
        id: widget_info.id,
    });
    return {widget: widget.widget};
});

connection.onRequest('$/lean/widgetEvent', async params => {
    const widget = params.widget;
    const response = await server.send({
        command: 'widget_event',
        kind: params.kind,
        handler: params.handler,
        args: params.args,
        file_name: URI.parse(params.textDocument.uri).fsPath,
        line: widget.line,
        column: widget.column,
        id: widget.id,
    });
    return response;
});

connection.listen();
