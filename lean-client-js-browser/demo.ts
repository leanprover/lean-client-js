import * as lean from './src';

window.onload = () => {
    const p = document.createElement('p');
    p.innerText = 'Look at the output in the console.';
    document.body.appendChild(p);

    const opts: lean.LeanJsOpts = {
        javascript: 'https://leanprover.github.io/lean.js/lean3.js',
        // javascript: '/lean_js_js.js',
        // webassemblyJs: '/lean_js_wasm.js',
        // webassemblyWasm: '/lean_js_wasm.wasm',
        // libraryZip: '/library.zip',
    };

    const transport =
        (window as any).Worker ?
            new lean.WebWorkerTransport(opts) :
            new lean.BrowserInProcessTransport(opts);
    const server = new lean.Server(transport);
    server.error.on((err) => console.log('error:', err));
    server.allMessages.on((allMessages) => console.log('messages:', allMessages.msgs));
    server.tasks.on((currentTasks) => console.log('tasks:', currentTasks.tasks));

    (self as any).server = server; // allow debugging from the console

    server.connect();

    const testfile = ''
        + 'variables p q r s : Prop\n'
        + 'theorem my_and_comm : p /\\ q <-> q /\\ p :=\n'
        + 'iff.intro\n'
        + '  (assume Hpq : p /\\ q,\n'
        + '    and.intro (and.elim_right Hpq) (and.elim_left Hpq))\n'
        + '  (assume Hqp : q /\\ p,\n'
        + '    and.intro (and.elim_right Hqp) (and.elim_left Hqp))\n'
        + '#check @nat.rec_on\n'
        + '#print "end of file!"\n';

    server.sync({command: 'sync', file_name: 'test.lean', content: testfile})
        .catch((err) => console.log('error while syncing file:', err));

    server.info({command: 'info', file_name: 'test.lean', line: 3, column: 0})
        .then((res) => console.log(`got info: ${JSON.stringify(res)}`))
        .catch((err) => console.log('error while getting info:', err));
};
