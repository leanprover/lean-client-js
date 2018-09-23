#!/usr/bin/env node
import {Message, ProcessTransport, Server, Severity} from 'lean-client-js-node';
import {CompletionItem, CompletionItemKind, createConnection, Definition, Diagnostic, DiagnosticSeverity, Hover,
    IConnection, InitializeParams, InitializeResult, Location, MarkedString, Position, Range, ResponseError,
    TextDocument, TextDocumentPositionParams, TextDocuments, TextDocumentSyncKind} from 'vscode-languageserver';
import Uri from 'vscode-uri';

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

const documents = new TextDocuments();
documents.listen(connection);

connection.onInitialize((params): InitializeResult => {
    server.transport = new ProcessTransport('lean', params.rootPath, []);
    server.connect();
    sendRoi();
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {},
            definitionProvider: true,
            hoverProvider: true,
        },
    };
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent((change) => {
    server.sync(Uri.parse(change.document.uri).fsPath, change.document.getText());
});

function sendRoi() {
    server.roi('visible-files',
        documents.keys().map((uri) =>
            ({file_name: Uri.parse(uri).fsPath,
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
        const line = Math.max(message.pos_line - 1, 0);
        const range = Range.create(line, message.pos_col, line, message.pos_col);
        const diagnostics = diagnosticMap.get(Uri.file(message.file_name).toString());
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

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
    const fileName = Uri.parse(textDocumentPosition.textDocument.uri).fsPath;
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
    const fileName = Uri.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    return server.info(fileName, position.line + 1, position.character).then((response) => {
        if (response.record && response.record.source) {
            const src = response.record.source;
            const uri = src.file ? Uri.file(src.file).toString() : params.textDocument.uri;
            const pos = Position.create(src.line - 1, src.column);
            return [Location.create(uri, Range.create(pos, pos))];
        } else {
            return [];
        }
    });
}) as any);

connection.onHover((params): Promise<Hover> => {
    const fileName = Uri.parse(params.textDocument.uri).fsPath;
    const position = params.position;
    return server.info(fileName, position.line + 1, position.character).then((response) => {
        const marked: MarkedString[] = [];
        const record = response.record;
        if (!record) {
            return {contents: []};
        }
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
        if (response.record.state) {
            marked.push({language: 'lean', value: record.state});
        }
        return {
            contents: marked,
            range: Range.create(position, position),
        } as Hover;
    });
});

connection.listen();
