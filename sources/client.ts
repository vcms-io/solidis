import { EventEmitter } from 'node:events';

import { auth } from './command/auth.ts';
import { clientSetname } from './command/client.setname.ts';
import { hello } from './command/hello.ts';
import { info } from './command/info.ts';
import { select } from './command/select.ts';
import {
  SolidisMaximumTimerDelay,
  SolidisSubscribeEventNames,
} from './common/constants.ts';
import { generateDebugHandle } from './common/utils/debug.ts';
import {
  RespError,
  SolidisClientError,
  SolidisConnectionError,
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
  SolidisClientEvents,
  SolidisClientExtensions,
  SolidisClientFrozenOptions,
  SolidisClientOptions,
  SolidisData,
  SolidisDebugLogType,
  SolidisSendOptions,
  StringOrBuffer,
} from './types/solidis.ts';

type SolidisHandshake = Pick<SolidisClient, 'send'>;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getServerMessage(error: unknown) {
  const { cause } = wrapWithError(error);

  return cause instanceof RespError ? cause.message : '';
}

export class SolidisClient extends EventEmitter {
  readonly #options: SolidisClientFrozenOptions;
  readonly #pubSub: SolidisPubSub;
  readonly #connection: SolidisConnection;
  readonly #requester: SolidisRequester;
  readonly #debugMemory?: SolidisDebugMemory;
  readonly #debug?: (
    type: SolidisDebugLogType,
    message: string,
    data?: unknown,
  ) => void;

  #isReady = false;
  #hasBeenReady = false;
  #session = 0;
  #pendingConnects = 0;
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

    this.#setupListeners();
    this.setMaxListeners(this.#options.maxEventListenersForClient);

    if (!this.#options.lazyConnect) {
      this.connect().catch((error: unknown) => {
        if (!this.#connection.isQuitted) {
          this.emit('error', wrapWithError(error));
        }
      });
    }
  }

  public get uri() {
    const { host, port, tls, authentication } = this.#options;
    const credentials =
      authentication.username && authentication.password
        ? `${encodeURIComponent(authentication.username)}:***@`
        : '';

    return `${tls ? 'rediss' : 'redis'}://${credentials}${host.includes(':') ? `[${host}]` : host}:${port}`;
  }

  public async send(
    commands: StringOrBuffer[][],
    options?: SolidisSendOptions,
  ): Promise<SolidisData[][]> {
    if (!this.#isReady) {
      try {
        await this.#connectWithin(
          options?.timeout ?? this.#options.commandTimeout,
        );
      } catch (error) {
        throw new SolidisClientError('Not connected with redis server.', error);
      }
    }

    return await this.#requester.send(commands, options);
  }

  public async connect(): Promise<void> {
    this.#pendingConnects += 1;

    try {
      await this.#ready();
    } finally {
      this.#pendingConnects -= 1;
    }
  }

  public quit() {
    this.#isReady = false;
    this.#session += 1;

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

    this.#debugMemory?.on('pushed', (entry) =>
      queueMicrotask(() => this.#notify('debug', entry)),
    );

    this.on('error', (error: Error) => {
      this.#debug?.('error', 'Encountered an error', error);

      if (this.listenerCount('error') === 1) {
        process.emitWarning(error);
      }
    });

    connection.on('connect', () => this.#onConnect());
    connection.on('close', (error) => this.#onClose(error));
    connection.on('reconnecting', (attempt, delay) =>
      this.#notify('reconnecting', attempt, delay),
    );
    connection.on('error', (error) => this.emit('error', error));

    for (const event of ['drain', 'end'] as const) {
      connection.on(event, () => this.#notify(event));
    }
  }

  #notify<E extends keyof SolidisClientEvents>(
    event: E,
    ...parameters: Parameters<SolidisClientEvents[E]>
  ) {
    try {
      this.emit(event, ...parameters);
    } catch (error) {
      const failure = new SolidisClientError(
        `A '${event}' listener threw`,
        error,
      );

      if (event === 'debug') {
        process.emitWarning(failure);
      } else {
        this.emit('error', failure);
      }
    }
  }

  #onConnect() {
    this.#session += 1;

    const session = this.#session;

    this.#notify('connect');

    this.#initialization = this.#initialize(session);
    this.#initialization.catch(() => {});
  }

  #onClose(error: Error) {
    this.#isReady = false;
    this.#session += 1;

    this.#notify('close', error);

    if (this.#options.autoReconnect && this.#hasBeenReady) {
      this.#connection.reconnect();
    }
  }

  async #ready() {
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

  async #waitForReady() {
    let attempt = 0;

    while (true) {
      await this.#connection.connect();

      try {
        await this.#initialization;

        return;
      } catch (error) {
        if (
          !(error instanceof SolidisConnectionError) ||
          attempt >= this.#options.maxConnectionRetries
        ) {
          throw error;
        }
      }

      attempt += 1;
    }
  }

  async #connectWithin(timeout: number) {
    const ready = this.#ready();

    if (timeout <= 0 || timeout > SolidisMaximumTimerDelay) {
      return await ready;
    }

    let timer: NodeJS.Timeout | undefined;

    const expiry = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new SolidisRequesterError(
              `Connection was not ready within ${timeout} ms.`,
            ),
          ),
        timeout,
      );
    });

    try {
      await Promise.race([ready, expiry]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #initialize(session: number) {
    const handshake: SolidisHandshake = {
      send: (commands: StringOrBuffer[][]) =>
        session === this.#session
          ? this.#requester.send(commands)
          : Promise.reject(
              new SolidisRequesterError('Socket is not connected.'),
            ),
    };

    let failure: unknown;

    try {
      await this.#negotiate(handshake);
      await this.#checkReadiness(handshake);
      await this.#restoreSession(handshake);
    } catch (error) {
      if (session === this.#session) {
        this.#debug?.('error', 'Initialization failed', error);

        if (this.#pendingConnects === 0) {
          this.emit('error', wrapWithError(error));
        }

        this.#connection.reset(wrapWithError(error));

        throw error;
      }

      failure = error;
    }

    if (session !== this.#session) {
      throw new SolidisConnectionError(
        'Connection closed during the handshake.',
        failure,
      );
    }

    const isReconnected = this.#hasBeenReady;

    this.#isReady = true;
    this.#hasBeenReady = true;

    this.#connection.resetBackoff();

    this.#debug?.('info', 'Initialization completed');

    this.#notify('ready');

    if (isReconnected) {
      this.#notify('reconnected');
    }
  }

  async #negotiate(handshake: SolidisHandshake) {
    const { protocol, clientName } = this.#options;
    const { username, password } =
      this.#requester.authentication ?? this.#options.authentication;

    let isAuthenticated = password === '';
    let isNamed = clientName === '';

    if (protocol === SolidisProtocols.RESP3) {
      try {
        await hello.call(handshake, protocol, username, password, clientName);

        isAuthenticated = true;
        isNamed = true;
      } catch (error) {
        const message = getServerMessage(error);

        if (!/^NOPROTO|unknown command/.test(message)) {
          throw new SolidisClientError(
            /^(WRONGPASS|NOAUTH)/.test(message)
              ? 'Authentication failed'
              : 'Protocol negotiation failed',
            error,
          );
        }

        this.#debug?.('warn', 'Protocol selection failed', error);
      }
    }

    if (!isAuthenticated) {
      try {
        await auth.call(handshake, username, password);
      } catch (error) {
        throw new SolidisClientError('Authentication failed', error);
      }
    }

    if (!isNamed) {
      try {
        await clientSetname.call(handshake, clientName);
      } catch (error) {
        this.#debug?.('warn', `CLIENT SETNAME "${clientName}" failed`, error);
      }
    }
  }

  async #checkReadiness(handshake: SolidisHandshake) {
    const { enableReadyCheck, readyCheckInterval, maxReadyCheckRetries } =
      this.#options;

    if (!enableReadyCheck) {
      return;
    }

    let attempt = 0;

    while (true) {
      let persistence: Record<string, string>;

      try {
        persistence = await info.call(handshake, 'persistence');
      } catch (error) {
        if (/^NOPERM/.test(getServerMessage(error))) {
          return;
        }

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

  async #restoreSession(handshake: SolidisHandshake) {
    const { autoRecovery, database } = this.#options;
    const pubSub = this.#pubSub;
    const selectedDatabase = this.#requester.database;
    const targetDatabase = autoRecovery.database ? selectedDatabase : database;

    if (targetDatabase !== 0 || selectedDatabase !== 0) {
      await select.call(handshake, targetDatabase);
    }

    for (const eventName of SolidisSubscribeEventNames) {
      if (!autoRecovery[eventName]) {
        pubSub.clearSubscriptions(eventName);
      }

      const subscriptions = pubSub.getSubscriptions(eventName);

      if (subscriptions.length === 0) {
        continue;
      }

      const error = await handshake
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
