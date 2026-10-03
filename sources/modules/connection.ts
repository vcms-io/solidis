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

function createQuitError() {
  return new SolidisConnectionError(
    'Cannot connect: user quit the connection.',
  );
}

function createRetryError(maxConnectionRetries: number, cause?: unknown) {
  return new SolidisConnectionError(
    `Connection failed after ${maxConnectionRetries} retries.`,
    cause,
  );
}

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
  #readyAt = Number.POSITIVE_INFINITY;
  #failedAttempts = 0;
  #remainingReconnects = 0;
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
      return Promise.reject(createQuitError());
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

    if (!this.#isReconnecting) {
      this.#isReconnecting = true;
      this.#remainingReconnects = this.#options.maxConnectionRetries + 1;
    }

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

    this.#countFailure();
    this.#destroySocket();
    this.emit('close', error);
  }

  public resetBackoff() {
    this.#readyAt = performance.now();
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
    this.#rejectWaiters(createQuitError());
    this.emit('end');
  }

  #startAttempts() {
    if (
      this.#isQuitted ||
      this.#socket !== null ||
      this.#retryTimer !== undefined
    ) {
      return;
    }

    const delay = this.#getRetryDelay();

    if (delay === 0 && !this.#isReconnecting) {
      this.#attempt();

      return;
    }

    this.#retryTimer = setTimeout(() => this.#attempt(), delay);

    this.emit('reconnecting', this.#failedAttempts + 1, delay);
  }

  #getRetryDelay() {
    const { connectionRetryDelay, maxConnectionRetryDelay } = this.#options;

    if (this.#failedAttempts === 0) {
      return 0;
    }

    return Math.round(
      (Math.min(
        connectionRetryDelay * 2 ** (this.#failedAttempts - 1),
        maxConnectionRetryDelay,
      ) *
        (1 + Math.random())) /
        2,
    );
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
    this.#readyAt = Number.POSITIVE_INFINITY;
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

    this.#countFailure();

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
    this.#remainingReconnects -= 1;

    this.#waiters = this.#waiters.filter((waiter) => {
      waiter.remainingAttempts -= 1;

      if (waiter.remainingAttempts > 0) {
        return true;
      }

      waiter.reject(createRetryError(maxConnectionRetries, error));

      return false;
    });

    if (this.#isReconnecting && this.#remainingReconnects <= 0) {
      this.#isReconnecting = false;

      this.emit('error', createRetryError(maxConnectionRetries, error));
    } else {
      this.emit('error', error);
    }

    if (this.#waiters.length > 0 || this.#isReconnecting) {
      this.#startAttempts();
    } else {
      this.#failedAttempts = 0;
    }
  }

  #countFailure() {
    if (
      performance.now() - this.#readyAt >=
      this.#options.maxConnectionRetryDelay
    ) {
      this.#failedAttempts = 0;
    } else {
      this.#failedAttempts += 1;
    }
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
