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

server.sync({command: 'sync', file_name: 'test.lean', content: testfile})
    .catch((err) => console.log(`error while syncing file: ${err}`));

server.send({command: 'sleep'});

server.info({command: 'info', file_name: 'test.lean', line: 3, column: 0})
    .then((res) => console.log(`got info: ${JSON.stringify(res)}`))
    .catch((err) => console.log(`error while getting info: ${err}`))
    .then(() => process.exit(0));
