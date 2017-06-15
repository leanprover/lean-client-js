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
    + '    and.intro (and.elim_right Hqp) {!!})\n'
    + '#check @nat.rec_on\n'
    + '#print "end of file!"\n';

async function demo(): Promise<any> {
    await server.sync('test.lean', testfile);

    server.send({command: 'sleep'});

    const holes = await server.allHoleCommands('test.lean');
    for (const hole of holes.holes) {
        for (const action of hole.results) {
            await server.hole(hole.file, hole.start.line, hole.start.column, action.name)
                .then((res) => console.log(`executed hole ${action.name}`, res))
                .catch((err) => console.log(`hole error for ${action.name}`, err));
        }
    }

    const info = await server.info('test.lean', 3, 0);
    console.log(`got info: ${JSON.stringify(info)}`);
}

async function main(): Promise<any> {
    await demo();
    server.restart();
    await demo();
    process.exit(0);
}

main().catch((err) => console.log('error:', err));
