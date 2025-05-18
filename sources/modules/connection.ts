import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';

import {
  SolidisConnectionError,
  generateDebugHandle,
  wrapWithSolidisConnectionError,
} from '../index.ts';

import type {
  SolidisClientFrozenOptions,
  SolidisConnectionEventHandlers,
  SolidisConnectionOptions,
  SolidisDebugLogType,
  SolidisSocket,
} from '../index.ts';

export class SolidisConnection extends EventEmitter {
  #options: SolidisConnectionOptions;
  #socket: SolidisSocket | null = null;

  #isConnected = false;
  #isQuitted = false;

  #connectLock: Promise<void> | null = null;
  #connectTimeout: NodeJS.Timeout | null = null;

  #debug?: (type: SolidisDebugLogType, message: string, data?: unknown) => void;

  public declare emit: SolidisConnectionEventHandlers<this>['emit'];
  public declare on: SolidisConnectionEventHandlers<this>['on'];

  constructor(options: SolidisConnectionOptions) {
    super();

    this.#options = options;

    this.#debug = generateDebugHandle(options.debugMemory);
  }

  public get socket() {
    return this.#socket;
  }

  public get isConnected() {
    return this.#isConnected;
  }

  public get isQuitted() {
    return this.#isQuitted;
  }

  public async connect(options: SolidisClientFrozenOptions) {
    this.#options = options;

    if (this.#isQuitted) {
      throw new SolidisConnectionError(
        'Cannot connect because user quit the connection.',
      );
    }

    if (this.#isConnected && this.#socket) {
      return;
    }

    if (this.#connectLock) {
      return await this.#connectLock;
    }

    this.#connectLock = this.#tryConnectWithRetry();

    try {
      await this.#connectLock;
    } finally {
      this.#connectLock = null;
    }
  }

  public cleanup() {
    this.#isConnected = false;

    if (this.#connectTimeout) {
      clearTimeout(this.#connectTimeout);
      this.#connectTimeout = null;
    }

    if (this.#socket) {
      this.#socket.end(() => {
        this.#socket?.removeAllListeners();
        this.#socket?.destroy();
        this.#socket?.unref();
        this.#socket = null;
      });
    }
  }

  public quit() {
    this.#isQuitted = true;

    this.cleanup();
    this.emit('end');
  }

  async #tryConnectWithRetry() {
    let attemptIndex = 0;

    const maxConnectionRetries = this.#options.maxConnectionRetries;

    while (true) {
      attemptIndex += 1;

      try {
        await this.#tryConnect();
        return;
      } catch (error) {
        if (this.#isQuitted) {
          throw wrapWithSolidisConnectionError(error);
        }

        if (attemptIndex > maxConnectionRetries) {
          throw new SolidisConnectionError(
            `SolidisClient connection failed after ${maxConnectionRetries} retries.`,
            error,
          );
        }

        await new Promise<void>((resolve) =>
          setTimeout(resolve, this.#options.connectionRetryDelay),
        );
      }
    }
  }

  async #tryConnect() {
    if (this.#isQuitted) {
      throw new SolidisConnectionError(
        'Cannot connect: user quit the connection.',
      );
    }

    if (this.#socket) {
      this.cleanup();
    }

    return await new Promise<void>((resolve, reject) => {
      const onFail = (reason: unknown) => {
        this.#isConnected = false;

        this.cleanup();

        reject(wrapWithSolidisConnectionError(reason));
      };

      const timeoutHandle = this.#setupConnectionTimeout(
        this.#options.connectionTimeout,
        (reason?: unknown) => onFail(reason),
      );

      const onConnect = () => {
        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);

          this.#connectTimeout = null;
        }

        resolve();

        this.#isConnected = true;

        this.#socket?.setNoDelay(true);
        this.#socket?.setKeepAlive(true);

        this.emit('connect');
      };

      const { host, port, useTLS } = this.#parseSocketOptions();

      const socket = this.#createSocket({
        host,
        port,
        useTLS,
        onConnect,
      });

      this.#setupSocketErrorHandler(socket);
      this.#setupSocketCloseHandler(socket, onFail);

      socket.setMaxListeners(this.#options.maxEventListenersForSocket);
      this.setMaxListeners(this.#options.maxEventListenersForClient);

      this.#socket = socket;
    });
  }

  async #tryBackgroundReconnect(): Promise<void> {
    if (!this.#options) {
      return;
    }

    if (this.#connectLock) {
      return await this.#connectLock;
    }

    this.#connectLock = this.#tryConnectWithRetry();

    try {
      await this.#connectLock;
    } finally {
      this.#connectLock = null;
    }
  }

  #createSocket({
    host,
    port,
    useTLS,
    onConnect,
  }: {
    host: string;
    port: number;
    useTLS: boolean;
    onConnect: () => void;
  }): SolidisSocket {
    if (useTLS) {
      return tls.connect({ host, port }, onConnect);
    }

    return net.connect({ host, port }, onConnect);
  }

  #setupSocketErrorHandler(socket: SolidisSocket) {
    socket.on('error', (error: unknown) => {
      this.#debug?.('error', 'Socket error event fired.', { error });

      this.emit('error', wrapWithSolidisConnectionError(error));
    });
  }

  #setupSocketCloseHandler(
    socket: SolidisSocket,
    emitFail: (reason: unknown) => void,
  ) {
    socket.on('close', () => {
      process.nextTick(() => {
        if (!this.#isConnected) {
          emitFail(
            new SolidisConnectionError('Socket closed before connection.'),
          );

          return;
        }

        this.#debug?.('debug', 'Solidis connection closed.');

        this.cleanup();
        this.emit(
          'closed',
          new SolidisConnectionError('Solidis connection closed.'),
        );

        if (this.#isQuitted) {
          return;
        }

        if (!this.#options || !this.#options.autoReconnect) {
          return;
        }

        this.#tryBackgroundReconnect().catch((error) => {
          this.#debug?.(
            'debug',
            'Solidis connection failed to background reconnect.',
            { error },
          );

          emitFail(error);
        });
      });
    });
  }

  #setupConnectionTimeout(
    connectionTimeout: number,
    onTimeout: (reason?: unknown) => void,
  ): NodeJS.Timeout | null {
    if (connectionTimeout <= 0) {
      return null;
    }

    const timer = setTimeout(() => {
      this.cleanup();

      const timeoutError = new SolidisConnectionError(
        `SolidisClient connection timeout (${connectionTimeout} ms).`,
      );

      onTimeout(timeoutError);
    }, connectionTimeout);

    this.#connectTimeout = timer;

    return timer;
  }

  #parseSocketOptions() {
    if (this.#options.uri) {
      const url = new URL(this.#options.uri);

      return {
        authentication: {
          username: url.username,
          password: url.password
        },
        host: url.hostname,
        port: url.port ? Number.parseInt(url.port) : 6379,
        useTLS: this.#options.useTLS || url.protocol === 'rediss:',
      };
    }

    return {
      host: this.#options.host,
      port: this.#options.port,
      useTLS: this.#options.useTLS,
    };
  }
}
