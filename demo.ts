import * as lean from './src/browser';

declare var window, document;

window.onload = () => {
    let p = document.createElement('p');
    p.innerText = 'Look at the output in the console.';
    document.body.appendChild(p);

    let leanJsFile = 'https://leanprover.github.io/lean.js/lean3.js';

    let transport = 
        window.Worker ?
            new lean.WebWorkerTransport(leanJsFile) :
            new lean.BrowserInProcessTransport(leanJsFile);
    let server = new lean.Server(transport,
        (err) => console.log(`unrelated error: ${err}`),
        (allMessages) => console.log('messages', allMessages.msgs),
        (currentTasks) => console.log('tasks:', currentTasks.tasks));

    (self as any).server = server; // allow debugging from the console
    
    server.connect();

    let testfile = ''
        + 'variables p q r s : Prop\n'
        + 'theorem my_and_comm : p /\\ q <-> q /\\ p :=\n'
        + 'iff.intro\n'
        + '  (assume Hpq : p /\\ q,\n'
        + '    and.intro (and.elim_right Hpq) (and.elim_left Hpq))\n'
        + '  (assume Hqp : q /\\ p,\n'
        + '    and.intro (and.elim_right Hqp) (and.elim_left Hqp))\n'
        + 'check @nat.rec_on\n'
        + 'print "end of file!"\n';

    server.sync({command: 'sync', file_name: 'test.lean', content: testfile})
        .catch((err) => console.log(`error while syncing file: ${err}`));

    server.info({command: 'info', file_name: 'test.lean', line: 3, column: 0})
        .then((res) => console.log(`got info: ${JSON.stringify(res)}`))
        .catch((err) => console.log(`error while getting info: ${err}`));
};