import { EventEmitter } from 'node:events';

import { auth, hello, info, select } from './command/basic.ts';
import {
  SolidisClientError,
  SolidisConnection,
  SolidisDebugMemory,
  SolidisDefaultOptions,
  SolidisProtocols,
  SolidisPubSub,
  SolidisRequester,
  generateDebugHandle,
  wrapWithError,
  wrapWithParserError,
  wrapWithSolidisClientError,
} from './index.ts';

import type {
  SolidisClientEventHandlers,
  SolidisClientEvents,
  SolidisClientExtensions,
  SolidisClientFrozenOptions,
  SolidisClientOptions,
  SolidisClientRecoveryStep,
  SolidisData,
  SolidisDebugLogType,
  SolidisPSubscribeMethod,
  SolidisSSubscribeMethod,
  SolidisSocket,
  SolidisSubscribeMethod,
  StringOrBuffer,
} from './index.ts';

export class SolidisClient extends EventEmitter {
  #options: SolidisClientFrozenOptions;
  #pubSub: SolidisPubSub;
  #connection: SolidisConnection;
  #requester: SolidisRequester;

  #connectLock: Promise<unknown> | null = null;

  #debug?: (type: SolidisDebugLogType, message: string, data?: unknown) => void;
  #debugMemory?: SolidisDebugMemory;

  public declare emit: SolidisClientEventHandlers<this>['emit'];
  public declare on: SolidisClientEventHandlers<this>['on'];
  public declare once: SolidisClientEventHandlers<this>['once'];

  [key: string]: unknown;

  constructor(options: SolidisClientOptions = {}) {
    super();

    this.#options = {
      ...SolidisDefaultOptions,
      ...Object.fromEntries(
        Object.entries(options).filter(([_, value]) => value !== undefined),
      ),
    };

    this.#setupDebug();

    this.#pubSub = new SolidisPubSub();
    this.#connection = new SolidisConnection({
      ...this.#options,
      debugMemory: this.#debugMemory,
    });
    this.#requester = new SolidisRequester({
      ...this.#options,
      connection: this.#connection,
      pubSub: this.#pubSub,
      debugMemory: this.#debugMemory,
    });

    this.#setupDefaultErrorListener();
    this.#setupConnectionListeners();

    this.setMaxListeners(this.#options.maxEventListenersForClient);

    if (!this.#options.lazyConnect) {
      this.connect().catch((error) => {
        this.emit('error', error);
      });
    }
  }

  #setupDebug() {
    const { debug, debugMaxEntries } = this.#options;

    if (!debug) {
      return;
    }

    this.#debugMemory = new SolidisDebugMemory(debugMaxEntries).on(
      'pushed',
      (entry) => {
        this.emit('debug', entry);
      },
    );

    this.#debug = generateDebugHandle(this.#debugMemory);
  }

  public async send(commands: StringOrBuffer[][]): Promise<SolidisData[][]> {
    try {
      await this.connect();
    } catch (error) {
      throw new SolidisClientError('Not connected with redis server.', error);
    }

    return await this.#requester.send(commands);
  }

  public async connect() {
    if (this.#connectLock) {
      return await this.#connectLock;
    }

    if (this.#connection.isQuitted) {
      throw new SolidisClientError(
        'Cannot connect after the client was closed.',
      );
    }

    if (this.#connection.isConnected && !this.#connection.isQuitted) {
      this.#debug?.('info', 'Solidis client connection already established');

      return;
    }

    const initializeLock = this.#setupInitializeListeners();

    this.#connectLock = this.#connection.connect(this.#options);

    try {
      return await Promise.all([initializeLock, this.#connectLock]);
    } finally {
      this.#connectLock = null;
    }
  }

  public quit() {
    this.#connection.quit();
  }

  public hello = hello.bind(this);
  public auth = auth.bind(this);
  public info = info.bind(this);
  public select = select.bind(this);

  #setupDefaultErrorListener() {
    this.on('error', (error: Error) => {
      this.#debug?.('error', 'Solidis client encountered an error', error);
    });
  }

  #setupInitializeListeners() {
    return new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        this.off('ready', onReady);
        reject(error);
      };

      this.once('ready', onReady);
      this.once('error', onError);
    });
  }

  #setupConnectionListeners() {
    this.#connection.on('connect', () => this.#onConnect());
    this.#connection.on('end', () => this.#onEnd());
    this.#connection.on('error', (error) => this.#onError(error));
    this.#connection.on('closed', (error) => this.#onClosed(error));
  }

  #setupSocketListeners(socket: SolidisSocket) {
    socket.on('data', (chunk: Buffer) => this.#onData(chunk));
    socket.on('drain', () => this.emit('drain'));
  }

  async #onConnect() {
    this.#debug?.('info', 'Solidis connection established');

    this.emit('connect');

    const socket = this.#connection.socket;

    if (socket) {
      this.#setupSocketListeners(socket);
    }

    try {
      const authenticated = await this.#hello();

      if (!authenticated) {
        await this.#authenticate();

        if (this.#options.protocol === SolidisProtocols.RESP3) {
          await this.#hello();
        }
      }

      await this.#readyCheck();
      await this.#recoveryAfterConnect();

      this.#debug?.('info', 'Solidis client initialization completed');

      this.emit('ready');
    } catch (error) {
      this.#onInitializeError(error);
    }
  }

  #cleanupConnection() {
    if (this.#connection.isConnected) {
      this.#connection.cleanup();
    }
  }

  #onData(chunk: Buffer) {
    this.#debug?.('debug', 'Solidis connection socket received data', chunk);

    try {
      this.#requester.onReply(
        chunk,
        <E extends keyof SolidisClientEvents>(
          event: E,
          ...parameters: Parameters<SolidisClientEvents[E]>
        ) => {
          return this.emit(event, ...parameters);
        },
      );
    } catch (parserError) {
      this.emit('error', wrapWithParserError(parserError));

      this.#cleanupConnection();
    }
  }

  #onInitializeError(error: unknown) {
    this.#debug?.('error', 'Solidis client initialization failed', error);
    this.emit('error', wrapWithError(error));

    this.#cleanupConnection();
  }

  #onError(error: Error) {
    this.#debug?.('error', 'Solidis connection error occurred', error);
    this.emit('error', wrapWithSolidisClientError(error));
  }

  #onEnd() {
    this.#debug?.('info', 'Solidis connection terminated');
    this.emit('end');
  }

  #onClosed(error: Error) {
    this.#debug?.('error', 'Solidis connection closed unexpectedly', error);

    this.#requester.recoveryFromFault(wrapWithSolidisClientError(error));
  }

  async #hello() {
    const {
      protocol,
      clientName,
      authentication: { username, password },
    } = this.#options;

    if (protocol === SolidisProtocols.RESP2) {
      return false;
    }

    try {
      await this.hello(protocol, username, password, clientName);

      if (username && password) {
        return true;
      }
    } catch (error) {
      this.#debug?.('error', 'Protocol selection failed', error);
    }

    return false;
  }

  async #authenticate() {
    const {
      authentication: { username, password },
    } = this.#options;

    if (!username && !password) {
      this.#debug?.(
        'info',
        'Skipping authentication: credentials are not provided',
      );

      return;
    }

    try {
      await this.auth(username, password);
    } catch (error) {
      this.#debug?.('error', 'Authentication failed', error);

      throw new SolidisClientError('Authentication failed', error);
    }
  }

  async #readyCheck() {
    const { enableReadyCheck, readyCheckInterval } = this.#options;

    if (!enableReadyCheck) {
      this.#debug?.('info', 'Skipping ready check: ready check is disabled.');

      return;
    }

    try {
      const result = await this.info('persistence');

      if (!result.loading || result.loading === '0') {
        this.#debug?.('info', 'Ready check completed');

        return;
      }

      await new Promise((resolve) => setTimeout(resolve, readyCheckInterval));

      await this.#readyCheck();
    } catch (error) {
      this.#debug?.('error', 'Ready check failed with error', error);
    }
  }

  async #recoveryAfterConnect() {
    const {
      autoRecovery: { database, subscribe, ssubscribe, psubscribe },
    } = this.#options;

    await this.#recoveryStep({
      condition: !!database && this.#options.database > 0,
      method: this.select<this>,
      methodName: 'select',
      parameters: [this.#options.database],
    });

    const pubSub = this.#pubSub;

    await Promise.all([
      this.#recoveryStep({
        condition: !!subscribe && pubSub.subscribedChannels.size > 0,
        method: this.subscribe as SolidisSubscribeMethod,
        methodName: 'subscribe',
        parameters: Array.from(pubSub.subscribedChannels),
      }),
      this.#recoveryStep({
        condition: !!ssubscribe && pubSub.subscribedShardChannels.size > 0,
        method: this.ssubscribe as SolidisSSubscribeMethod,
        methodName: 'ssubscribe',
        parameters: Array.from(pubSub.subscribedShardChannels),
      }),
      this.#recoveryStep({
        condition: !!psubscribe && pubSub.subscribedPatterns.size > 0,
        method: this.psubscribe as SolidisPSubscribeMethod,
        methodName: 'psubscribe',
        parameters: Array.from(pubSub.subscribedPatterns),
      }),
    ]);
  }

  async #recoveryStep<
    T extends (...parameters: Parameters<T>) => Promise<unknown>,
  >({
    condition,
    method,
    methodName,
    parameters,
  }: SolidisClientRecoveryStep<T>) {
    if (condition) {
      this.#debug?.('debug', `Solidis client ${methodName} recovery step`);

      if (method) {
        await method(...parameters).catch((error) => {
          this.#debug?.('error', `${methodName} recovery failed`, error);
        });
      }
    }
  }

  public extend<T extends Record<string, unknown>>(
    extensions: T & ThisType<SolidisClient>,
  ): this & SolidisClientExtensions<T> {
    for (const method of Object.getOwnPropertyNames(extensions)) {
      if (
        method !== 'constructor' &&
        typeof extensions[method] === 'function'
      ) {
        this[method] = extensions[method].bind(this);
      }
    }

    return this as this & SolidisClientExtensions<T>;
  }
}
