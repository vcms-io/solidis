import { EventEmitter } from 'node:events';

import { auth } from './command/auth.ts';
import { clientSetname } from './command/client.setname.ts';
import { hello } from './command/hello.ts';
import { info } from './command/info.ts';
import { select } from './command/select.ts';
import { SolidisSubscribeEventNames } from './common/constants.ts';
import { generateDebugHandle } from './common/utils/debug.ts';
import {
  RespError,
  SolidisClientError,
  SolidisRequesterError,
  wrapWithError,
} from './common/utils/error.ts';
import { resolveClientOptions } from './common/utils/options.ts';
import { findErrorInReplies } from './common/utils/reply.ts';
import { SolidisConnection } from './modules/connection.ts';
import { SolidisDebugMemory } from './modules/debug.ts';
import { SolidisPubSub } from './modules/pubsub.ts';
import { SolidisRequester } from './modules/requester.ts';
import { SolidisProtocols } from './types/solidis.ts';

import type {
  SolidisClientEventHandlers,
  SolidisClientExtensions,
  SolidisClientFrozenOptions,
  SolidisClientOptions,
  SolidisData,
  SolidisDebugLogType,
  SolidisSendOptions,
  StringOrBuffer,
} from './types/solidis.ts';

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class SolidisClient extends EventEmitter {
  readonly #options: SolidisClientFrozenOptions;
  readonly #pubSub: SolidisPubSub;
  readonly #connection: SolidisConnection;
  readonly #requester: SolidisRequester;
  readonly #handshake: Pick<SolidisClient, 'send'>;
  readonly #debugMemory?: SolidisDebugMemory;
  readonly #debug?: (
    type: SolidisDebugLogType,
    message: string,
    data?: unknown,
  ) => void;

  #isReady = false;
  #hasBeenReady = false;
  #readyLock: Promise<void> | null = null;
  #initialization: Promise<void> | null = null;

  declare public emit: SolidisClientEventHandlers<this>['emit'];
  declare public on: SolidisClientEventHandlers<this>['on'];
  declare public once: SolidisClientEventHandlers<this>['once'];

  [key: string]: unknown;

  constructor(options: SolidisClientOptions = {}) {
    super();

    const emit = this.emit.bind(this);

    this.#options = resolveClientOptions(options);
    this.#debugMemory = this.#options.debug
      ? new SolidisDebugMemory(this.#options.debugMaxEntries)
      : undefined;
    this.#debug = generateDebugHandle(this.#debugMemory);
    this.#pubSub = new SolidisPubSub(emit);
    this.#connection = new SolidisConnection({
      ...this.#options,
      debugMemory: this.#debugMemory,
    });
    this.#requester = new SolidisRequester({
      ...this.#options,
      connection: this.#connection,
      pubSub: this.#pubSub,
      emit,
      debugMemory: this.#debugMemory,
    });
    this.#handshake = {
      send: (commands: StringOrBuffer[][]) => this.#requester.send(commands),
    };

    this.#setupListeners();
    this.setMaxListeners(this.#options.maxEventListenersForClient);

    if (!this.#options.lazyConnect) {
      this.connect().catch((error: unknown) => {
        this.emit('error', wrapWithError(error));
      });
    }
  }

  public get uri() {
    const { host, port, tls, authentication } = this.#options;
    const prefix = tls ? 'rediss' : 'redis';

    if (authentication.username && authentication.password) {
      return `${prefix}://${authentication.username}:***@${host}:${port}`;
    }

    return `${prefix}://${host}:${port}`;
  }

  public async send(
    commands: StringOrBuffer[][],
    options?: SolidisSendOptions,
  ): Promise<SolidisData[][]> {
    if (!this.#isReady) {
      try {
        await this.#connectWithinCommandTimeout();
      } catch (error) {
        throw new SolidisClientError('Not connected with redis server.', error);
      }
    }

    return await this.#requester.send(commands, options);
  }

  public async connect(): Promise<void> {
    if (this.#connection.isQuitted) {
      throw new SolidisClientError(
        'Cannot connect after the client was closed.',
      );
    }

    if (this.#isReady) {
      return;
    }

    this.#readyLock ??= this.#waitForReady().finally(() => {
      this.#readyLock = null;
    });

    await this.#readyLock;
  }

  public quit() {
    this.#isReady = false;

    this.#connection.quit();
  }

  public hello = hello.bind(this);
  public auth = auth.bind(this);
  public info = info.bind(this);
  public select = select.bind(this);

  public extend<T extends Record<string, unknown>>(
    extensions: T & ThisType<SolidisClient>,
  ): this & SolidisClientExtensions<T> {
    for (const method of Object.getOwnPropertyNames(extensions)) {
      const extension = extensions[method];

      if (method !== 'constructor' && typeof extension === 'function') {
        this[method] = extension.bind(this);
      }
    }

    return this as this & SolidisClientExtensions<T>;
  }

  #setupListeners() {
    const connection = this.#connection;

    this.#debugMemory?.on('pushed', (entry) => this.emit('debug', entry));

    this.on('error', (error: Error) => {
      this.#debug?.('error', 'Encountered an error', error);
    });

    connection.on('connect', () => this.#onConnect());
    connection.on('close', (error) => this.#onClose(error));
    connection.on('reconnecting', (attempt, delay) =>
      this.emit('reconnecting', attempt, delay),
    );
    connection.on('error', (error) => this.emit('error', error));
    connection.on('drain', () => this.emit('drain'));
    connection.on('end', () => this.emit('end'));
  }

  #onConnect() {
    this.emit('connect');

    this.#initialization = this.#initialize();
    this.#initialization.catch((error: unknown) => {
      if (this.#readyLock === null) {
        this.emit('error', wrapWithError(error));
      }
    });
  }

  #onClose(error: Error) {
    this.#isReady = false;

    this.emit('close', error);

    if (this.#options.autoReconnect && this.#hasBeenReady) {
      this.#connection.reconnect();
    }
  }

  async #waitForReady() {
    await this.#connection.connect();
    await this.#initialization;
  }

  async #connectWithinCommandTimeout() {
    const { commandTimeout } = this.#options;
    const connection = this.connect();

    if (commandTimeout <= 0) {
      return await connection;
    }

    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new SolidisRequesterError(
              `Connection was not ready within ${commandTimeout} ms.`,
            ),
          ),
        commandTimeout,
      );
    });

    try {
      await Promise.race([connection, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #initialize() {
    try {
      await this.#negotiate();
      await this.#checkReadiness();
      await this.#restoreSession();
    } catch (error) {
      this.#debug?.('error', 'Initialization failed', error);

      this.#connection.reset(wrapWithError(error));

      throw error;
    }

    this.#isReady = true;

    this.#connection.resetBackoff();

    this.#debug?.('info', 'Initialization completed');

    this.emit('ready');

    if (this.#hasBeenReady) {
      this.emit('reconnected');
    }

    this.#hasBeenReady = true;
  }

  async #negotiate() {
    const {
      protocol,
      clientName,
      authentication: { username, password },
    } = this.#options;

    let isAuthenticated = false;
    let isNamed = false;

    if (protocol === SolidisProtocols.RESP3) {
      try {
        await hello.call(
          this.#handshake,
          protocol,
          username,
          password,
          clientName,
        );

        isAuthenticated = password !== '';
        isNamed = clientName !== '';
      } catch (error) {
        const cause = error instanceof Error ? error.cause : undefined;

        if (
          cause instanceof RespError &&
          (cause.code === 'WRONGPASS' || cause.code === 'NOAUTH')
        ) {
          throw new SolidisClientError('Authentication failed', error);
        }

        this.#debug?.('warn', 'Protocol selection failed', error);
      }
    }

    if (!isAuthenticated && password !== '') {
      try {
        await auth.call(this.#handshake, username, password);
      } catch (error) {
        throw new SolidisClientError('Authentication failed', error);
      }
    }

    if (!isNamed && clientName !== '') {
      try {
        await clientSetname.call(this.#handshake, clientName);
      } catch (error) {
        this.#debug?.('warn', `CLIENT SETNAME "${clientName}" failed`, error);
      }
    }
  }

  async #checkReadiness() {
    const { enableReadyCheck, readyCheckInterval, maxReadyCheckRetries } =
      this.#options;

    if (!enableReadyCheck) {
      return;
    }

    let attempt = 0;

    while (true) {
      let persistence: Record<string, string>;

      try {
        persistence = await info.call(this.#handshake, 'persistence');
      } catch (error) {
        throw new SolidisClientError('Ready check failed', error);
      }

      if (persistence.loading !== '1') {
        return;
      }

      if (attempt >= maxReadyCheckRetries) {
        throw new SolidisClientError(
          `Ready check failed: still loading after ${maxReadyCheckRetries} retries`,
        );
      }

      attempt += 1;

      await sleep(readyCheckInterval);
    }
  }

  async #restoreSession() {
    const { autoRecovery, database } = this.#options;
    const pubSub = this.#pubSub;
    const selectedDatabase = this.#requester.database;
    const targetDatabase = autoRecovery.database ? selectedDatabase : database;

    if (targetDatabase !== 0 || selectedDatabase !== 0) {
      await select.call(this.#handshake, targetDatabase);
    }

    for (const eventName of SolidisSubscribeEventNames) {
      if (!autoRecovery[eventName]) {
        pubSub.clearSubscriptions(eventName);
      }

      const subscriptions = pubSub.getSubscriptions(eventName);

      if (subscriptions.size === 0) {
        continue;
      }

      const error = await this.#requester
        .send([[eventName.toUpperCase(), ...subscriptions]])
        .then(findErrorInReplies, (sendError: unknown) => sendError);

      if (!error) {
        continue;
      }

      if (!(error instanceof RespError)) {
        throw error;
      }

      pubSub.clearSubscriptions(eventName);

      this.emit(
        'error',
        new SolidisClientError('Failed to restore subscriptions', error),
      );
    }
  }
}
