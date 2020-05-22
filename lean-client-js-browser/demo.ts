import * as lean from './src';

window.onload = () => {
    const p = document.createElement('p');
    p.innerText = 'Look at the output in the console.';
    document.body.appendChild(p);

    // const prefix = window.location.origin;
    const prefix = '.';
    const opts: lean.LeanJsOpts = {
        // javascript: 'https://leanprover.github.io/lean.js/lean3.js',
        javascript: prefix + '/lean_js_js.js',
        webassemblyJs: prefix + '/lean_js_wasm.js',
        webassemblyWasm: prefix + '/lean_js_wasm.wasm',
        libraryZip: prefix + '/library.zip',
        // Uncomment to test optional fields
        // libraryMeta: prefix + '/library.info.json',
        // libraryOleanMap: prefix + '/library.olean_map.json',
        // dbName: 'leanlib2',
        // libraryKey: 'lib'
    };

    const transport = new lean.WebWorkerTransport(opts);
        // (window as any).Worker ?
        //     new lean.WebWorkerTransport(opts) :
        //     new lean.BrowserInProcessTransport(opts);
    const server = new lean.Server(transport);
    server.error.on((err) => console.log('error:', err));
    server.allMessages.on((allMessages) => console.log('messages:', allMessages.msgs));
     // emscripten lean never fires 'tasks' (requires MULTI_THREAD)
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

    server.sync('test.lean', testfile)
        .catch((err) => console.log('error while syncing file:', err));

    server.info('test.lean', 3, 0)
        .then((res) => console.log(`got info: ${JSON.stringify(res)}`))
        .catch((err) => console.log('error while getting info:', err));
};
