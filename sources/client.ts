import { auth } from './command/auth.ts';
import { clientSetname } from './command/client.setname.ts';
import { hello } from './command/hello.ts';
import { info } from './command/info.ts';
import { select } from './command/select.ts';
import { SolidisSubscribeEventNames } from './common/constants.ts';
import {
  SolidisAuthenticationErrorPattern,
  SolidisAuthenticationFailedMessage,
  SolidisMaximumTimerDelay,
} from './common/internal.ts';
import {
  RespError,
  SolidisClientError,
  SolidisCommandError,
  SolidisConnectionError,
  SolidisRequesterError,
  wrapWithError,
} from './common/utils/error.ts';
import {
  resolveTimerDelay,
  SolidisClientQuitMessage,
  SolidisSocketNotConnectedMessage,
} from './common/utils/internal.ts';
import { resolveClientOptions } from './common/utils/options.ts';
import { findErrorInReplies } from './common/utils/reply.ts';
import { toCommandError } from './common/utils/request.ts';
import { SolidisConnection } from './modules/connection.ts';
import {
  copyCommands,
  EventEmitter,
  errorMonitor,
  SolidisSessionSendOptions,
} from './modules/internal.ts';
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
  SolidisDebugHandle,
  SolidisSendOptions,
  StringOrBuffer,
} from './types/solidis.ts';

type SolidisHandshake = Pick<SolidisClient, 'send'>;

export class SolidisClient extends EventEmitter {
  readonly #options: SolidisClientFrozenOptions;
  readonly #pubSub: SolidisPubSub;
  readonly #connection: SolidisConnection;
  readonly #requester: SolidisRequester;
  readonly #debug?: SolidisDebugHandle;

  #isReady = false;
  #hasBeenReady = false;
  #session = 0;
  #pendingConnects = 0;
  #readyLock: Promise<void> | null = null;
  #initialization: Promise<void> | null = null;
  #interruptReadyCheck: (() => void) | undefined;
  #waitingRequests = new Set<(cause?: unknown) => void>();

  declare public on: SolidisClientEventHandlers<this>['on'];
  declare public once: SolidisClientEventHandlers<this>['once'];

  [key: string]: unknown;

  constructor(options: SolidisClientOptions = {}) {
    super();

    const emit = this.emit.bind(this);

    this.#options = resolveClientOptions(options);
    this.#debug = this.#options.debug
      ? (type, message, data) => {
          const entry = { timestamp: Date.now(), type, message, data };

          queueMicrotask(() => this.#notify('debug', entry));
        }
      : undefined;
    const connectionOptions = { ...this.#options, debugHandle: this.#debug };

    this.#pubSub = new SolidisPubSub(emit);
    this.#connection = new SolidisConnection(connectionOptions);
    this.#requester = new SolidisRequester({
      ...connectionOptions,
      connection: this.#connection,
      pubSub: this.#pubSub,
      emit,
    });

    this.#setupListeners();
    this.setMaxListeners(
      Math.max(0, this.#options.maxEventListenersForClient) || 0,
    );

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
      authentication.username || authentication.password
        ? `${encodeURIComponent(authentication.username)}:***@`
        : '';

    return `${tls ? 'rediss' : 'redis'}://${credentials}${host.includes(':') ? `[${host}]` : host}:${port}`;
  }

  public send(
    commands: StringOrBuffer[][],
    options?: SolidisSendOptions,
  ): Promise<SolidisData[][]> {
    if (this.#isReady) {
      return this.#requester.send(commands, options);
    }

    const batch = copyCommands(commands);
    const requestOptions = options && { ...options };

    return new Promise((resolve, reject) => {
      const timeout = resolveTimerDelay(
        options?.timeout ?? this.#options.commandTimeout,
      );
      const settle = (cause?: unknown) => {
        clearTimeout(timer);

        this.#waitingRequests.delete(settle);

        if (cause === undefined) {
          resolve(this.#requester.send(batch, requestOptions));
        } else {
          reject(
            this.#connection.isQuitted
              ? new SolidisClientError(SolidisClientQuitMessage)
              : new SolidisClientError(
                  'Not connected with redis server.',
                  cause,
                ),
          );
        }
      };
      const timer = timeout
        ? setTimeout(
            () =>
              settle(
                new SolidisRequesterError(
                  `Connection was not ready within ${timeout} ms.`,
                ),
              ),
            timeout,
          )
        : undefined;

      this.#waitingRequests.add(settle);
      this.#awaitReadiness();
    });
  }

  public async connect(): Promise<void> {
    this.#pendingConnects += 1;

    try {
      if (!this.#isReady) {
        await this.#awaitReadiness();
      }
    } finally {
      this.#pendingConnects -= 1;
    }
  }

  public quit() {
    this.#isReady = false;
    this.#readyLock = null;
    this.#session += 1;

    this.#connection.quit();
    this.#interruptReadyCheck?.();
  }

  public hello = hello.bind(this);
  public auth = auth.bind(this);
  public info = info.bind(this);
  public select = select.bind(this);

  public extend<T extends Record<string, unknown>>(
    extensions: T & ThisType<this & SolidisClientExtensions<T, this>>,
  ): this & SolidisClientExtensions<T, this> {
    for (const method of Object.getOwnPropertyNames(extensions)) {
      const extension = extensions[method];

      if (method !== 'constructor' && typeof extension === 'function') {
        this[method] = extension.bind(this);
      }
    }

    return this as this & SolidisClientExtensions<T, this>;
  }

  public override emit<E extends keyof SolidisClientEvents>(
    event: E,
    ...parameters: Parameters<SolidisClientEvents[E]>
  ) {
    if (event !== 'error') {
      return super.emit(event, ...parameters);
    }

    this.#debug?.('error', 'Encountered an error', parameters[0]);

    try {
      if (this.listenerCount('error') > 0) {
        return super.emit(event, ...parameters);
      }

      super.emit(errorMonitor, ...parameters);
      process.emitWarning(wrapWithError(parameters[0]));
    } catch (error) {
      queueMicrotask(() => {
        throw error;
      });
    }

    return false;
  }

  #setupListeners() {
    const connection = this.#connection;

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
    this.#interruptReadyCheck?.();

    this.#notify('close', error);

    if (this.#options.autoReconnect && this.#hasBeenReady) {
      this.#connection.reconnect();
    }
  }

  #awaitReadiness() {
    if (!this.#readyLock) {
      this.#readyLock = this.#waitForReady().finally(() => {
        this.#readyLock = null;
      });
      this.#readyLock.catch((error: unknown) => {
        for (const settle of this.#waitingRequests) {
          settle(error);
        }
      });
    }

    return this.#readyLock;
  }

  async #waitForReady() {
    let attempt = 0;

    while (true) {
      if (this.#connection.isQuitted) {
        throw new SolidisClientError(SolidisClientQuitMessage);
      }

      await this.#connection.connect();

      try {
        await this.#initialization;

        if (this.#isReady) {
          return;
        }
      } catch (error) {
        if (
          !this.#connection.isQuitted &&
          (!(error instanceof SolidisConnectionError) ||
            attempt >= this.#options.maxConnectionRetries)
        ) {
          throw error;
        }
      }

      attempt += 1;
    }
  }

  async #initialize(session: number) {
    const handshake: SolidisHandshake = {
      send: (commands: StringOrBuffer[][]) =>
        session === this.#session
          ? this.#requester.send(commands, SolidisSessionSendOptions)
          : Promise.reject(
              new SolidisRequesterError(SolidisSocketNotConnectedMessage),
            ),
    };

    let failure: unknown;

    try {
      await this.#negotiate(handshake);
      await this.#checkReadiness(handshake);
      await this.#restoreSession(handshake);
    } catch (error) {
      if (session === this.#session) {
        const reason = wrapWithError(error);

        this.#debug?.('error', 'Initialization failed', error);

        if (this.#pendingConnects === 0) {
          this.emit('error', reason);
        }

        this.#connection.reset(reason);

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

    for (const settle of this.#waitingRequests) {
      settle();
    }

    this.#connection.resetBackoff();

    this.#debug?.('info', 'Initialization completed');

    this.#notify('ready');

    if (isReconnected && session === this.#session) {
      this.#notify('reconnected');
    }
  }

  async #negotiate(handshake: SolidisHandshake) {
    const clientName = this.#options.clientName || undefined;
    const protocol =
      this.#requester.negotiatedProtocol ?? this.#options.protocol;
    const { username, password } =
      this.#requester.authentication ?? this.#options.authentication;
    const credentials =
      username || password
        ? ([username, password] as const)
        : ([undefined, undefined] as const);

    const negotiation =
      protocol === SolidisProtocols.RESP3 &&
      (await this.#runStep(
        hello.call(handshake, protocol, ...credentials, clientName),
        'Protocol negotiation failed',
        /^NOPROTO|unknown command/,
      ));

    if (!negotiation && (username || password)) {
      await this.#runStep(
        auth.call(handshake, username, password),
        SolidisAuthenticationFailedMessage,
      );
    }

    if (!negotiation && clientName) {
      await this.#runStep(
        clientSetname.call(handshake, clientName),
        'CLIENT SETNAME failed',
        /^NOPERM|unknown command/,
      );
    }
  }

  async #runStep<T>(step: Promise<T>, failure: string, tolerated?: RegExp) {
    try {
      return await step;
    } catch (error) {
      const { cause } = wrapWithError(error);
      const message = cause instanceof RespError ? cause.message : '';

      if (!tolerated?.test(message)) {
        throw new SolidisClientError(
          SolidisAuthenticationErrorPattern.test(message)
            ? SolidisAuthenticationFailedMessage
            : failure,
          error,
        );
      }

      this.#debug?.('warn', failure, error);

      return undefined;
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
      const persistence = await this.#runStep(
        info.call(handshake, 'persistence'),
        'Ready check failed',
        /^NOPERM/,
      );

      if (persistence?.loading !== '1') {
        return;
      }

      if (attempt >= maxReadyCheckRetries) {
        throw new SolidisClientError(
          `Ready check failed: still loading after ${maxReadyCheckRetries} retries`,
        );
      }

      attempt += 1;

      await new Promise<void>((resolve) => {
        this.#interruptReadyCheck = resolve;

        setTimeout(
          resolve,
          Math.min(readyCheckInterval, SolidisMaximumTimerDelay),
        ).unref();
      });
    }
  }

  async #restoreSession(handshake: SolidisHandshake) {
    const { autoRecovery, database } = this.#options;
    const pubSub = this.#pubSub;
    const selectedDatabase = this.#requester.database;
    const targetDatabase = autoRecovery.database ? selectedDatabase : database;

    if (targetDatabase !== 0 || selectedDatabase !== 0) {
      await this.#runStep(
        select.call(handshake, targetDatabase),
        'SELECT failed',
      );
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
        .send(subscriptions.map((subscription) => [eventName, subscription]))
        .then(findErrorInReplies, (sendError: unknown) =>
          sendError instanceof SolidisCommandError
            ? sendError.cause
            : sendError,
        );

      if (!error) {
        continue;
      }

      if (!(error instanceof RespError)) {
        throw error;
      }

      if (SolidisAuthenticationErrorPattern.test(error.message)) {
        throw new SolidisClientError(SolidisAuthenticationFailedMessage, error);
      }

      await handshake.send([[eventName.replace('sub', 'unsub')]]);

      this.emit(
        'error',
        new SolidisClientError(
          'Failed to restore subscriptions',
          toCommandError(error, [eventName, ...subscriptions]).cause,
        ),
      );
    }
  }
}
