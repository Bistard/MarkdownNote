import { Disposable, IDisposable, untrackDisposable } from "src/base/common/dispose";
import { toIPCTransferableError } from "src/base/common/error";
import { Emitter, Event, Register } from "src/base/common/event";
import { BufferReader, BufferWriter, DataBuffer } from "src/base/common/files/buffer";
import { ILogService } from "src/base/common/logger";
import { ITask } from "src/base/common/utilities/async";
import { If, Pair } from "src/base/common/utilities/type";
import { ChannelType, IChannel, IServerChannel } from "src/platform/ipc/common/channel";
import { IProtocol } from "src/platform/ipc/common/protocol";

// #region Type Declaration

const hasBuffer: boolean = typeof Buffer !== 'undefined';

/**
 * Data types are allowed to be transferred between {@link ClientBase} and 
 * {@link ServerBase}.
 */
export const enum DataType {
    Undefined = 0,
    String,
    Buffer,
    DataBuffer,
    Array,
    Object
}

// [request (client perspective)]

const enum RequestType {
    Command = 0,
    Register,
    Unregister
}

type ICommandRequest = { type: RequestType.Command; id: number; channel: ChannelType; commandOrEvent: string; arg?: any; };
type IRegisterRequest = { type: RequestType.Register; id: number; channel: ChannelType; commandOrEvent: string; arg?: any; };
type IUnregisterRequest = { type: RequestType.Unregister; id: number; };
type IRequest = ICommandRequest | IRegisterRequest | IUnregisterRequest;

type ICommandHeader = [RequestType.Command, number, ChannelType, string];
type IRegisterHeader = [RequestType.Register, number, ChannelType, string];
type IUnregisterHeader = [RequestType.Unregister, number];
type IRequestHeader = ICommandHeader | IRegisterHeader | IUnregisterHeader;
type IRequestBody = any;

type SerializeType<IsClient, IsBody> = If<IsBody, any, If<IsClient, IRequestHeader, IResponseHeader>>;

/**
 * @internal
 * @class When channel server / client needs to send response / request to
 * the other side, the class can serialize the sending data into standard data
 * type {@link DataBuffer} during communication.
 * 
 * During each data serialization, it will try to do three things:
 *      1. Write 1 byte for data type.
 *      2. Write 4 bytes for size length.
 *      3. Write enough bytes for the actual data.
 * 
 * @note When writing {@link DataType.Undefined} it only does the first thing.
 */
class DataSerializer {

    // [field]

    private readonly _writer = new BufferWriter();

    private static readonly _8BitType = {
        Undef:   DataSerializer.__get8BitType(DataType.Undefined),
        Str:     DataSerializer.__get8BitType(DataType.String),
        Buf:     DataSerializer.__get8BitType(DataType.Buffer),
        DataBuf: DataSerializer.__get8BitType(DataType.DataBuffer),
        Arr:     DataSerializer.__get8BitType(DataType.Array),
        Obj:     DataSerializer.__get8BitType(DataType.Object),
    };

    private static __get8BitType(value: number): DataBuffer {
        const result = DataBuffer.alloc(1);
        result.writeUInt8(0, value);
        return result;
    }

    // [constructor]

    constructor() { }

    // [public methods]

    get buffer(): DataBuffer {
        return this._writer.buffer;
    }

    public serialize<IsClient, IsBody>(data: SerializeType<IsClient, IsBody>): void {

        if (typeof data === 'undefined') {
            this._writer.write(DataSerializer._8BitType.Undef);
        }
        else if (typeof data === 'string') {
            const buffer = DataBuffer.fromString(data);
            this._writer.write(DataSerializer._8BitType.Str);
            this._writer.write(this.__write32BitSize(buffer.bufferLength));
            this._writer.write(buffer);
        }
        else if (hasBuffer && Buffer.isBuffer(data)) {
            const buffer = DataBuffer.wrap(data);
            this._writer.write(DataSerializer._8BitType.Buf);
            this._writer.write(this.__write32BitSize(buffer.bufferLength));
            this._writer.write(buffer);
        }
        else if (data instanceof DataBuffer) {
            this._writer.write(DataSerializer._8BitType.DataBuf);
            this._writer.write(this.__write32BitSize(data.bufferLength));
            this._writer.write(data);
        }
        else if (Array.isArray(data)) {
            this._writer.write(DataSerializer._8BitType.Arr);
            this._writer.write(this.__write32BitSize(data.length));
            for (const el of data) {
                this.serialize<false, true>(el);
            }
        }
        else {
            // eslint-disable-next-line local/code-no-json-stringify
            const buffer = DataBuffer.fromString(JSON.stringify(data));
            this._writer.write(DataSerializer._8BitType.Obj);
            this._writer.write(this.__write32BitSize(buffer.bufferLength));
            this._writer.write(buffer);
        }
        return;
    }

    private __write32BitSize(size: number): DataBuffer {
        const result = DataBuffer.alloc(4);
        result.writeUInt32BE(0, size);
        return result;
    }
}

// [response (client perspective)]

const enum ResponseType {
    EventFire = 0,
    PromiseResolve,
    PromiseReject,
}

type IEventFireResponse = { type: ResponseType.EventFire; requestID: number; dataOrError: any; };
type IPromiseResolveResponse = { type: ResponseType.PromiseResolve; requestID: number; dataOrError: any; };
type IPromiseRejectResponse = { type: ResponseType.PromiseReject; requestID: number; dataOrError: Error; };
type IResponse = IEventFireResponse | IPromiseRejectResponse | IPromiseResolveResponse;

type IEventFireHeader = [ResponseType.EventFire, number];
type IPromiseResolveHeader = [ResponseType.PromiseResolve, number];
type IPromiseRejectHeader = [ResponseType.PromiseReject, number];
type IResponseHeader = IEventFireHeader | IPromiseResolveHeader | IPromiseRejectHeader;
type IResponseBody = any;
type DeserializeType<IsClient, IsBody> = If<IsBody, IResponseBody, If<IsClient, IResponseHeader, IRequestHeader>>;

/**
 * @internal
 * @class When channel server / client receives request / response from the 
 * other side, the class can deserialize the receiving data from standard data
 * type {@link DataBuffer} into actual data type.
 */
class BufferDeserializer {

    // [field]

    private _reader: BufferReader;

    // [constructor]

    constructor(buffer: DataBuffer) {
        this._reader = new BufferReader(buffer);
    }

    // [public methods]

    public deserialize<IsClient extends boolean, IsBody extends boolean>(): DeserializeType<IsClient, IsBody> {
        const type = this._reader.read(1).readUInt8(0);
        let result: any;

        if (type === DataType.Undefined) {
            result = undefined;
        }
        else if (type === DataType.String) {
            result = this._reader.read(this.__readSize()).toString();
        }
        else if (type === DataType.Buffer) {
            result = this._reader.read(this.__readSize()).buffer;
        }
        else if (type === DataType.DataBuffer) {
            result = this._reader.read(this.__readSize());
        }
        else if (type === DataType.Object) {
            result = JSON.parse(this._reader.read(this.__readSize()).toString());
        }
        else if (type === DataType.Array) {
            const length = this.__readSize();
            result = [];
            for (let i = 0; i < length; i++) {
                result.push(this.deserialize());
            }
        }

        return result;
    }

    // [private helper method]

    private __readSize(): number {
        return this._reader.read(4).readUInt32BE(0);
    }
}

// #endregion

// #region Channel client / server

export interface IChannelClient {
    /**
     * @description Get a {@link IChannel} given the channel name.
     * @note Channel might not exist since the return object is not the actual
     * object which does the job, instead it works like a proxy and it will send
     * the command as a request to the other side and waiting for a response.
     */
    getChannel(channel: ChannelType): IChannel;
}

/**
 * @class A channel client relies on the given {@link IProtocol}, it integrates
 * two things: 
 *      1. Get the corresponding channel and can manually send command through 
 *          the protocol. It returns a promise that resolves with the 
 *          corresponding response from the server.
 *      2. Register an event listener to the server side.
 * 
 * @note Serialization process are predefined by {@link DataSerializer} and 
 * {@link BufferDeserializer}.
 */
export class ChannelClient extends Disposable implements IChannelClient {

    // [field]

    private readonly _protocol: IProtocol;

    /** A auto increment ID to identify each different request. */
    private _requestID = 0;

    /**
     * After sending a request we immediately stores a callback to be executed
     * once the response is received.
     */
    private readonly _onResponseCallback = new Map<number, (res: IResponse) => void>();

    /** Marks all the activating request. */
    private readonly _activeRequest = new Set<IDisposable>();

    // [constructor]

    constructor(protocol: IProtocol) {
        super();
        this._protocol = protocol;
        this.__register(protocol.onData(data => this.__onResponse(data)));
    }

    // [public methods]

    public getChannel(channel: ChannelType): IChannel {
        return {
            callCommand: <T>(command: string, arg?: any): Promise<T> => {
                if (this.isDisposed()) {
                    return Promise.reject('channel is already disposed');
                }
                return this.__requestCommand(channel, command, arg);
            },
            registerListener: <T>(event: string, arg?: any): Register<T> => {
                if (this.isDisposed()) {
                    return Event.NONE;
                }
                return this.__requestEvent(channel, event, arg);
            },
        };
    }

    public override dispose(): void {
        super.dispose();
        for (const activeRequest of this._activeRequest) {
            activeRequest.dispose();
        }
    }

    // [private methods]

    private __onResponse(data: DataBuffer): void {
        const [header, rawData] = this.__deserializeResponse(data);
        const type = header[0]!;
        const requestID = header[1]!;

        switch (type) {
            case ResponseType.EventFire:
            case ResponseType.PromiseReject:
            case ResponseType.PromiseResolve: {
                const callback = this._onResponseCallback.get(requestID);
                callback?.({
                    type: type,
                    requestID: requestID,
                    dataOrError: rawData,
                });
                return;
            }
        }
    }

    private __requestCommand(channel: ChannelType, command: string, arg?: any): Promise<any> {
        const requestID = this._requestID++;
        const request: ICommandRequest = {
            type: RequestType.Command,
            id: requestID,
            channel: channel,
            commandOrEvent: command,
            arg: arg,
        };

        const responsePromise = new Promise((resolve, reject) => {

            const onResponseCallback = (response: IResponse): void => {
                this._onResponseCallback.delete(response.requestID);

                if (response.type === ResponseType.PromiseResolve) {
                    resolve(response.dataOrError);
                }
                else if (response.type === ResponseType.PromiseReject) {
                    reject(response.dataOrError);
                }
                else {
                    const error = new Error(`unknown response type: ${response.type}`);
                    error.cause = response.dataOrError;
                    reject(error);
                }
            };

            this._onResponseCallback.set(requestID, onResponseCallback);
            this.__sendRequest(request);
        });

        return responsePromise;
    }

    private __requestEvent(channel: ChannelType, event: string, arg?: any): Register<any> {
        const requestID = this._requestID++;
        const emitter = this.__register(new Emitter<any>({

            onFirstListenerAdd: () => {
                this._activeRequest.add(emitter);
                this.__sendRequest(<IRegisterRequest>{
                    type: RequestType.Register,
                    id: requestID,
                    channel: channel,
                    commandOrEvent: event,
                    arg: arg,
                });
            },

            onLastListenerDidRemove: () => {
                this._activeRequest.delete(emitter);
                this.__sendRequest(<IUnregisterRequest>{
                    type: RequestType.Unregister,
                    id: requestID,
                });
            },
        }));

        this._onResponseCallback.set(requestID, (res: IResponse) => emitter.fire(res.dataOrError));
        return emitter.registerListener;
    }

    private __sendRequest(request: IRequest): void {
        switch (request.type) {
            case RequestType.Command:
            case RequestType.Register: {
                const buffer = this.__serializeRequest([request.type, request.id, request.channel, request.commandOrEvent], request.arg);
                this._protocol.send(buffer);
                return;
            }
            case RequestType.Unregister: {
                const buffer = this.__serializeRequest([request.type, request.id], undefined);
                this._protocol.send(buffer);
                return;
            }
        }
    }

    private __serializeRequest(header: IRequestHeader, body: IRequestBody): DataBuffer {
        const serializer = new DataSerializer();
        serializer.serialize<true, true>(header);
        serializer.serialize<true, false>(body);
        return serializer.buffer;
    }

    private __deserializeResponse(buffer: DataBuffer): Pair<IResponseHeader, any> {
        const deserializer = new BufferDeserializer(buffer);
        const header = deserializer.deserialize<true, false>();
        const body = deserializer.deserialize<true, true>();
        return [header, body];
    }
}

export interface IChannelServer {
    /**
     * @description Register a {@link IServerChannel} into the current channel.
     * @note Once receiving a request from the other side, the channel will try
     * to find a corresponding server channel who can do the job and once the
     * server channel finish their job, this channel will send a response back
     * to the other side.
     */
    registerChannel(channelName: string, channel: IServerChannel): void;
}

/**
 * @class A channel server relies on the given {@link IProtocol}, it integrates
 * two things: 
 *      1. Register a channel and starts listening to the client request.
 *      2. Send response back to the client when the request is done by the 
 *          corresponding channel.
 * 
 * @note Serialization process are predefined by {@link DataSerializer} and 
 * {@link BufferDeserializer}.
 */
export class ChannelServer extends Disposable implements IChannelServer {

    // [field]

    private readonly _protocol: IProtocol;
    /** 
     * An identifier to give the {@link IServerChannel} a chance to know which 
     * channel server is accessing.
     */
    private readonly _id: string;
    private readonly _channels = new Map<string, IServerChannel>();
    private readonly _activeRequest = new Map<number, IDisposable>();

    // [constructor]

    constructor(protocol: IProtocol, id: string) {
        super();
        this._protocol = protocol;
        this._id = id;
        this.__register(protocol.onData(buffer => this.__onRequest(buffer)));
    }

    // [public methods]

    get id(): string { return this._id; }

    public registerChannel(name: ChannelType, channel: IServerChannel): void {
        this._channels.set(name, channel);
    }

    public override dispose(): void {
        super.dispose();
        for (const [id, activeRequest] of this._activeRequest) {
            activeRequest.dispose();
        }
    }

    // [private helper methods]

    private __onRequest(buffer: DataBuffer): Promise<void> | void {
        const [header, body] = this.__deserializeRequest(buffer);
        const type = header[0]!;

        switch (type) {
            case RequestType.Command:
                return this.__onCommandRequest(header as ICommandHeader, body);
            case RequestType.Register:
                return this.__onRegisterRequest(header as IRegisterHeader, body);
            case RequestType.Unregister:
                return this.__onDisposeRequest(header as IUnregisterHeader, body);
        }
    }

    private __deserializeRequest(buffer: DataBuffer): Pair<IRequestHeader, any> {
        const deserializer = new BufferDeserializer(buffer);
        const header = deserializer.deserialize<false, false>();
        const body = deserializer.deserialize<false, true>();
        return [header, body];
    }

    private async __onCommandRequest(header: ICommandHeader, data: any): Promise<void> {
        const requestID = header[1]!;
        const channelName = header[2]!;

        const channel = this._channels.get(channelName);
        if (!channel) {
            this.__onUnknownChannel(channelName, requestID, RequestType.Command);
            return;
        }

        const command = header[3]!;
        let invokingCommand: Promise<any>;
        try {
            invokingCommand = channel.callCommand(this._id, command, data);
        } catch (error) {
            invokingCommand = Promise.reject(error);
        }

        try {
            const rawData = await invokingCommand;
            this.__sendResponse(<IPromiseResolveResponse>{
                type: ResponseType.PromiseResolve,
                requestID: requestID,
                dataOrError: rawData,
            });
        }
        catch (err: any) {
            this.__sendResponse(<IPromiseRejectResponse>{
                type: ResponseType.PromiseReject,
                requestID: requestID,
                dataOrError: toIPCTransferableError(err),
            });
        }
    }

    private __onRegisterRequest(header: IRegisterHeader, data: any): void {
        const requestID = header[1]!;
        const channelName = header[2]!;

        const channel = this._channels.get(channelName);
        if (!channel) {
            this.__onUnknownChannel(channelName, requestID, RequestType.Register);
            return;
        }

        const event = header[3]!;
        const register = channel.registerListener(this.id, event, data);
        const unregister = untrackDisposable(
            register(eventData => this.__sendResponse({
                type: ResponseType.EventFire,
                requestID: requestID,
                dataOrError: eventData
            }))
        );

        this._activeRequest.set(requestID, unregister);
    }

    private __onDisposeRequest(header: IUnregisterHeader, data: any): void {
        const requestID = header[1]!;
        const unregister = this._activeRequest.get(requestID);
        if (unregister) {
            unregister.dispose();
            this._activeRequest.delete(requestID);
        }
    }

    private __sendResponse(response: IResponse): void {
        switch (response.type) {
            case ResponseType.EventFire:
            case ResponseType.PromiseResolve:
            case ResponseType.PromiseReject: {
                const buffer = this.__serializeResponse([response.type, response.requestID], response.dataOrError);
                this._protocol.send(buffer);
            }
        }
        return;
    }

    private __serializeResponse(header: IResponseHeader, body: any): DataBuffer {
        const requestSerializer = new DataSerializer();
        requestSerializer.serialize<false, true>(header);
        requestSerializer.serialize<false, false>(body);
        return requestSerializer.buffer;
    }

    private __onUnknownChannel(name: string, requestID: number, type: RequestType): void {
        if (type === RequestType.Command) {
            this.__sendResponse(<IPromiseRejectResponse>{
                type: ResponseType.PromiseReject,
                requestID: requestID,
                dataOrError: new Error(`Unknown channel: ${name}`),
            });
        }
    }
}

// #endregion

// #region Server / Client base

export interface IConnection {
    readonly id: string;
    readonly channelServer: ChannelServer;
    readonly channelClient: ChannelClient;
}

export interface IClientConnectEvent {
    readonly clientID: number | string;
    readonly protocol: IProtocol;
    onClientDisconnect: Register<void>;
}

/**
 * @class Caller can register a {@link IServerChannel} with {@link ChannelType}. 
 * Every time a client try to connect, the server will follow the same protocol
 * with the client and listen to its request. Once a request is received, it
 * will try to find a corresponding {@link IServerChannel} to finish the job and
 * send back a response.
 * 
 * Built upon of a {@link ChannelServer}.
 */
export class ServerBase extends Disposable implements IChannelServer {

    // [field]

    private readonly _channels = new Map<string, IServerChannel>();
    private readonly _connections = new Set<IConnection>();

    // [constructor]

    constructor(onClientConnect: Register<IClientConnectEvent>, protected readonly logService?: ILogService) {
        super();
        /**
         * When client connect to the server and receive its first request, we 
         * register all the current channels to it and register its onDisconnect
         * event.
         */
        this.__register(onClientConnect((event: IClientConnectEvent) => {
            this.logService?.debug('ServerBase', `client on connection (ID: ${event.clientID})`);
            const protocol = event.protocol;

            /**
             * Since a {@link ClientBase} will send a one-time request during 
             * initialization, we need to capture it first.
             */
            const onClientDisconnect = Event.onceSafe(event.onClientDisconnect);
            const onFirstRequest = Event.onceSafe(protocol.onData);
            onFirstRequest(data => {

                /**
                 * The first request is pre-defined. it only contains an ID of 
                 * the client in the body part of the request (empty header).
                 */
                const deserializer = new BufferDeserializer(data);
                const clientID = <string>deserializer.deserialize<false, true>();

                // create the corresponding channel.
                const channelServer = this.__register(new ChannelServer(protocol, clientID));

                // Register all the existed channels to the new connection.
                for (const [name, channel] of this._channels) {
                    channelServer.registerChannel(name, channel);
                }

                const connection: IConnection = { channelClient: <any>Disposable.NONE, channelServer, id: clientID };
                this._connections.add(connection);

                onClientDisconnect(() => {
                    this.release(channelServer);
                    this._connections.delete(connection);
                    this.logService?.debug('ServerBase', `client on disconnect (ID: ${event.clientID})`);
                });
            });
        }));
    }

    // [public methods]

    public registerChannel(name: string, channel: IServerChannel): void {
        this._channels.set(name, channel);
        for (const connection of this._connections) {
            connection.channelServer.registerChannel(name, channel);
        }
    }

    public override dispose(): void {
        super.dispose();
        this._channels.clear();
        for (const connection of this._connections) {
            this.release(connection.channelClient);
            this.release(connection.channelServer);
        }
        this._connections.clear();
    }
}

/**
 * @class Caller can get a {@link IChannel} with {@link ChannelType} (notice 
 * that the channel might not exist). You may call the command to the channel or 
 * register event listeners from the channel, and client base will send the 
 * request to the server-side to get a response.
 * 
 * Built upon of a {@link ChannelClient}.
 */
export class ClientBase extends Disposable implements IChannelClient {

    // [field]

    private _channelClient: ChannelClient;

    // [constructor]

    constructor(protocol: IProtocol, id: string, connect: ITask<void>) {
        super();
        connect();

        /**
         * Send the client ID to the server as the first request so that server
         * can prepare for client initialization.
         */
        const serializer = new DataSerializer();
        serializer.serialize<true, true>(id);
        protocol.send(serializer.buffer);

        this._channelClient = this.__register(new ChannelClient(protocol));
    }

    // [public methods]

    public getChannel(channel: ChannelType): IChannel {
        return this._channelClient.getChannel(channel);
    }
}

// #endregion
