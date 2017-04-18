export interface Transport {
    connect(onMessageReceived: (any) => void): Connection;
}

export interface Connection {
    send(msg: any);
    close();
}