export interface Transport {
    connect(onMessageReceived: (jsonMsg: any) => void): Connection;
}

export interface Connection {
    send(jsonMsg: any);
    close();
}