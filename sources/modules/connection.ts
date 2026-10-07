import net from 'node:net';
import tls from 'node:tls';

import { SolidisMaximumTimerDelay } from '../common/internal.ts';
import {
  SolidisClientError,
  SolidisConnectionError,
} from '../common/utils/error.ts';
import {
  resolveTimerDelay,
  SolidisClientQuitMessage,
  SolidisConnectionClosedMessage,
  SolidisSocketNotConnectedMessage,
  wrapWithSolidisError,
} from '../common/utils/internal.ts';
import { EventEmitter } from './internal.ts';

import type {
  SolidisConnectionEventHandlers,
  SolidisConnectionOptions,
  SolidisDebugHandle,
  SolidisSocket,
} from '../types/solidis.ts';

interface SolidisConnectionWaiter {
  resolve: (attempts: number) => void;
  reject: (error: Error) => void;
  remainingAttempts: number;
}

export class SolidisConnection extends EventEmitter {
  readonly #options: SolidisConnectionOptions;
  readonly #debug?: SolidisDebugHandle;
  readonly #retries: number;

  #socket: SolidisSocket | null = null;
  #isConnected = false;
  #isQuitted = false;
  #isReconnecting = false;
  #hasConnected = false;
  #readyAt = Number.NaN;
  #failedAttempts = 0;
  #remainingReconnects = 0;
  #retryTimer: NodeJS.Timeout | undefined;
  #waiters: SolidisConnectionWaiter[] = [];

  declare public emit: SolidisConnectionEventHandlers<this>['emit'];
  declare public on: SolidisConnectionEventHandlers<this>['on'];

  constructor(options: SolidisConnectionOptions) {
    super();

    this.#options = options;
    this.#debug = options.debugHandle;
    this.#retries = Math.max(options.maxConnectionRetries, 0) || 0;
  }

  public get isConnected() {
    return this.#isConnected;
  }

  public get isQuitted() {
    return this.#isQuitted;
  }

  public connect(attempts = this.#retries + 1): Promise<number> {
    if (this.#isQuitted) {
      return Promise.reject(new SolidisClientError(SolidisClientQuitMessage));
    }

    if (this.#isConnected) {
      return Promise.resolve(attempts);
    }

    this.#remainingReconnects = attempts;

    return new Promise<number>((resolve, reject) => {
      this.#waiters.push({ resolve, reject, remainingAttempts: attempts });

      this.#startAttempts();
    });
  }

  public reconnect() {
    if (this.#isConnected || !(this.#remainingReconnects > 0)) {
      return;
    }

    this.#isReconnecting = true;

    this.#startAttempts();
  }

  public write(buffer: Buffer): boolean {
    const socket = this.#socket;

    if (!socket || !this.#isConnected) {
      throw new SolidisConnectionError(SolidisSocketNotConnectedMessage);
    }

    return socket.write(buffer);
  }

  public reset(error: Error) {
    if (!this.#isConnected) {
      return;
    }

    this.#debug?.('warn', 'Connection reset', error);

    this.#destroySocket();
    this.#lose(error);
  }

  public resetBackoff() {
    this.#readyAt = performance.now();
  }

  public quit() {
    if (this.#isQuitted) {
      return;
    }

    this.#isQuitted = true;

    clearTimeout(this.#retryTimer);

    this.#destroySocket();
    this.#rejectWaiters(new SolidisClientError(SolidisClientQuitMessage));
    this.emit('end');
  }

  #startAttempts() {
    if (this.#isQuitted || this.#socket || this.#retryTimer) {
      return;
    }

    if (!this.#failedAttempts && !this.#isReconnecting && !this.#hasConnected) {
      this.#attempt();

      return;
    }

    const delay = this.#getRetryDelay();

    this.#retryTimer = setTimeout(() => this.#attempt(), delay);

    this.emit('reconnecting', this.#failedAttempts + 1, delay);
  }

  #getRetryDelay() {
    const { connectionRetryDelay, maxConnectionRetryDelay } = this.#options;

    if (this.#failedAttempts === 0) {
      return 0;
    }

    return resolveTimerDelay(
      Math.round(
        (Math.min(
          connectionRetryDelay * 2 ** (this.#failedAttempts - 1),
          maxConnectionRetryDelay,
          SolidisMaximumTimerDelay,
        ) *
          (1 + Math.random())) /
          2,
      ),
    );
  }

  #attempt() {
    const { host, port, connectionTimeout, tls: tlsOptions } = this.#options;

    let socket: SolidisSocket;

    this.#retryTimer = undefined;

    try {
      socket = tlsOptions
        ? tls.connect({
            servername: net.isIP(host) ? undefined : host,
            ...tlsOptions,
            host,
            port,
          })
        : net.connect({ host, port });
    } catch (error) {
      const failure = wrapWithSolidisError(SolidisConnectionError, error);

      this.#isReconnecting = false;

      if (this.#waiters.length) {
        this.#rejectWaiters(failure);
      } else {
        this.emit('error', failure);
      }

      return;
    }

    const timer = resolveTimerDelay(connectionTimeout)
      ? setTimeout(
          () =>
            socket.destroy(
              new SolidisConnectionError(
                `Connection timeout (${connectionTimeout} ms).`,
              ),
            ),
          connectionTimeout,
        )
      : undefined;

    let failure: unknown;

    this.#socket = socket;

    socket.once(tlsOptions ? 'secureConnect' : 'connect', () => {
      clearTimeout(timer);

      this.#onSocketConnect(socket);
    });

    socket.on('error', (error: Error) => {
      failure = error;

      this.#onSocketError(socket, error);
    });

    socket.on('close', () => {
      clearTimeout(timer);

      this.#onSocketClose(socket, failure);
    });

    socket.on('data', (chunk: Buffer) => {
      if (socket === this.#socket) {
        this.emit('data', chunk);
      }
    });

    socket.on('drain', () => {
      if (socket === this.#socket) {
        this.emit('drain');
      }
    });
  }

  #onSocketConnect(socket: SolidisSocket) {
    if (socket !== this.#socket) {
      return;
    }

    const waiters = this.#waiters;

    socket.setNoDelay(true);
    socket.setKeepAlive(true);

    this.#isConnected = true;
    this.#hasConnected = true;
    this.#readyAt = Number.NaN;
    this.#waiters = [];

    this.#debug?.('info', 'Connection established');

    for (const waiter of waiters) {
      waiter.resolve(waiter.remainingAttempts);
    }

    this.emit('connect');
  }

  #onSocketError(socket: SolidisSocket, error: Error) {
    if (socket !== this.#socket) {
      return;
    }

    this.#debug?.('error', 'Socket error', error);

    if (this.#isConnected) {
      this.emit('error', wrapWithSolidisError(SolidisConnectionError, error));
    }
  }

  #onSocketClose(socket: SolidisSocket, failure: unknown) {
    if (socket !== this.#socket) {
      return;
    }

    this.#socket = null;

    if (!this.#isConnected) {
      this.#onAttemptFailed(
        failure === undefined
          ? new SolidisConnectionError('Socket closed before connection.')
          : wrapWithSolidisError(SolidisConnectionError, failure),
      );

      return;
    }

    this.#isConnected = false;

    this.#debug?.('info', 'Connection closed');

    this.#lose(
      new SolidisConnectionError(SolidisConnectionClosedMessage, failure),
    );
  }

  #onAttemptFailed(error: SolidisConnectionError) {
    this.#waiters = this.#waiters.filter((waiter) => {
      waiter.remainingAttempts -= 1;

      if (waiter.remainingAttempts > 0) {
        return true;
      }

      waiter.reject(this.#createRetryError(error));

      return false;
    });

    const failure = this.#spendReconnect(error) ?? error;
    const isRetrying = this.#waiters.length > 0 || this.#isReconnecting;

    this.#failedAttempts = isRetrying ? this.#failedAttempts + 1 : 0;

    this.emit('error', failure);

    if (isRetrying) {
      this.#startAttempts();
    }
  }

  #lose(error: Error) {
    const { maxConnectionRetryDelay } = this.#options;

    let exhaustion: SolidisConnectionError | undefined;

    if (performance.now() - this.#readyAt >= (maxConnectionRetryDelay || 0)) {
      this.#failedAttempts = 0;
      this.#remainingReconnects = this.#retries + 1;
    } else {
      exhaustion = this.#spendReconnect(error);

      this.#failedAttempts = exhaustion ? 0 : this.#failedAttempts + 1;
    }

    this.emit('close', error);

    if (exhaustion && !this.#isQuitted) {
      this.emit('error', exhaustion);
    }
  }

  #spendReconnect(cause: unknown) {
    if (!this.#isReconnecting) {
      return undefined;
    }

    this.#remainingReconnects -= 1;

    if (this.#remainingReconnects > 0) {
      return undefined;
    }

    this.#isReconnecting = false;

    return this.#createRetryError(cause);
  }

  #createRetryError(cause: unknown) {
    return new SolidisConnectionError(
      `Connection failed after ${this.#retries} retries.`,
      cause,
    );
  }

  #destroySocket() {
    const socket = this.#socket;

    this.#socket = null;
    this.#isConnected = false;

    socket?.destroy();
  }

  #rejectWaiters(error: Error) {
    const waiters = this.#waiters;

    this.#waiters = [];

    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }
}
