import * as lean from './src';

const transport = new lean.ProcessTransport('lean', '.', []);
const server = new lean.Server(transport);
server.error.on((err) => console.log('error:', err));
server.allMessages.on((allMessages) => console.log('messages', allMessages.msgs));
server.tasks.on((currentTasks) => console.log('tasks:', currentTasks.tasks));

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

function demo(): Promise<any> {
    server.sync('test.lean', testfile)
        .catch((err) => console.log(`error while syncing file: ${err}`));

    server.send({command: 'sleep'});

    return server.info('test.lean', 3, 0)
        .then((res) => console.log(`got info: ${JSON.stringify(res)}`))
        .catch((err) => console.log(`error while getting info: ${err}`));
}

demo().then(() => server.restart())
      .then(() => demo())
      .then(() => process.exit(0));
