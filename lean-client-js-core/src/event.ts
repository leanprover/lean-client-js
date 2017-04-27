export interface EventListenerHandle {
    dispose();
}

export class Event<E> {
    handlers: Array<(_: E) => any> = [];

    on(handler: (_: E) => any): EventListenerHandle {
        this.handlers.push(handler);
        return { dispose: () => { this.handlers = this.handlers.filter((h) => h !== handler); } };
    }

    fire(event: E) {
        for (const h of this.handlers) {
            h(event);
        }
    }

    dispose() {
        this.handlers = [];
    }
}
