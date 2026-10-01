import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';

import { generateDebugHandle } from '../common/utils/debug.ts';
import {
  SolidisConnectionError,
  wrapWithSolidisConnectionError,
} from '../common/utils/error.ts';

import type {
  SolidisConnectionEventHandlers,
  SolidisConnectionOptions,
  SolidisDebugLogType,
  SolidisSocket,
} from '../types/solidis.ts';

interface SolidisConnectionWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  remainingAttempts: number;
}

export class SolidisConnection extends EventEmitter {
  readonly #options: SolidisConnectionOptions;
  readonly #debug?: (
    type: SolidisDebugLogType,
    message: string,
    data?: unknown,
  ) => void;

  #socket: SolidisSocket | null = null;
  #isConnected = false;
  #isQuitted = false;
  #isReconnecting = false;
  #failedAttempts = 0;
  #retryTimer: NodeJS.Timeout | undefined;
  #waiters: SolidisConnectionWaiter[] = [];

  declare public emit: SolidisConnectionEventHandlers<this>['emit'];
  declare public on: SolidisConnectionEventHandlers<this>['on'];

  constructor(options: SolidisConnectionOptions) {
    super();

    this.#options = options;
    this.#debug = generateDebugHandle(options.debugMemory);
  }

  public get isConnected() {
    return this.#isConnected;
  }

  public get isQuitted() {
    return this.#isQuitted;
  }

  public connect(): Promise<void> {
    if (this.#isQuitted) {
      return Promise.reject(
        new SolidisConnectionError('Cannot connect: user quit the connection.'),
      );
    }

    if (this.#isConnected) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.#waiters.push({
        resolve,
        reject,
        remainingAttempts: this.#options.maxConnectionRetries + 1,
      });

      this.#startAttempts();
    });
  }

  public reconnect() {
    if (this.#isQuitted || this.#isConnected) {
      return;
    }

    this.#isReconnecting = true;

    this.#startAttempts();
  }

  public write(buffer: Buffer): boolean {
    const socket = this.#socket;

    if (socket === null || !this.#isConnected) {
      throw new SolidisConnectionError('Socket is not connected.');
    }

    return socket.write(buffer);
  }

  public reset(error: Error) {
    if (!this.#isConnected) {
      return;
    }

    this.#debug?.('warn', 'Connection reset', error);

    this.#failedAttempts += 1;

    this.#destroySocket();
    this.emit('close', error);
  }

  public resetBackoff() {
    this.#failedAttempts = 0;
  }

  public quit() {
    if (this.#isQuitted) {
      return;
    }

    this.#isQuitted = true;
    this.#isReconnecting = false;

    clearTimeout(this.#retryTimer);

    this.#retryTimer = undefined;

    this.#destroySocket();
    this.#rejectWaiters(
      new SolidisConnectionError('Cannot connect: user quit the connection.'),
    );
    this.emit('end');
  }

  #startAttempts() {
    if (this.#socket !== null || this.#retryTimer !== undefined) {
      return;
    }

    const delay = this.#getRetryDelay();

    if (delay === 0) {
      this.#attempt();

      return;
    }

    this.#retryTimer = setTimeout(() => this.#attempt(), delay);
  }

  #getRetryDelay() {
    const { connectionRetryDelay, maxConnectionRetryDelay } = this.#options;

    if (this.#failedAttempts === 0) {
      return 0;
    }

    const half =
      Math.min(
        connectionRetryDelay * 2 ** (this.#failedAttempts - 1),
        maxConnectionRetryDelay,
      ) / 2;

    return Math.round(half + Math.random() * half);
  }

  #attempt() {
    const { host, port, connectionTimeout } = this.#options;
    const tlsOptions = this.#options.tls;
    const socket = tlsOptions
      ? tls.connect({ ...tlsOptions, host, port })
      : net.connect({ host, port });
    const timer =
      connectionTimeout > 0
        ? setTimeout(() => this.#onAttemptTimeout(socket), connectionTimeout)
        : undefined;

    let failure: unknown;

    this.#retryTimer = undefined;
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
      socket.destroy();

      return;
    }

    const waiters = this.#waiters;

    socket.setNoDelay(true);
    socket.setKeepAlive(true);

    this.#isConnected = true;
    this.#isReconnecting = false;
    this.#waiters = [];

    this.#debug?.('info', 'Connection established');

    for (const waiter of waiters) {
      waiter.resolve();
    }

    this.emit('connect');
  }

  #onSocketError(socket: SolidisSocket, error: Error) {
    if (socket !== this.#socket) {
      return;
    }

    this.#debug?.('error', 'Socket error', error);

    if (this.#isConnected) {
      this.emit('error', wrapWithSolidisConnectionError(error));
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
          : wrapWithSolidisConnectionError(failure),
      );

      return;
    }

    this.#isConnected = false;

    this.#debug?.('info', 'Connection closed');

    this.emit(
      'close',
      new SolidisConnectionError('Connection closed.', failure),
    );
  }

  #onAttemptTimeout(socket: SolidisSocket) {
    if (socket !== this.#socket) {
      return;
    }

    this.#socket = null;

    socket.destroy();

    this.#onAttemptFailed(
      new SolidisConnectionError(
        `Connection timeout (${this.#options.connectionTimeout} ms).`,
      ),
    );
  }

  #onAttemptFailed(error: SolidisConnectionError) {
    const { maxConnectionRetries } = this.#options;

    this.#failedAttempts += 1;

    this.emit('error', error);

    this.#waiters = this.#waiters.filter((waiter) => {
      waiter.remainingAttempts -= 1;

      if (waiter.remainingAttempts > 0) {
        return true;
      }

      waiter.reject(
        new SolidisConnectionError(
          `Connection failed after ${maxConnectionRetries} retries.`,
          error,
        ),
      );

      return false;
    });

    if (
      this.#isQuitted ||
      (this.#waiters.length === 0 && !this.#isReconnecting)
    ) {
      this.#failedAttempts = 0;

      return;
    }

    const delay = this.#getRetryDelay();

    this.emit('reconnecting', this.#failedAttempts, delay);

    this.#retryTimer = setTimeout(() => this.#attempt(), delay);
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
