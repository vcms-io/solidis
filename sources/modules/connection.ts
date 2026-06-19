import { EventEmitter } from 'node:events';
import net from 'node:net';
import tls from 'node:tls';

import {
  generateDebugHandle,
  SolidisConnectionError,
  wrapWithSolidisConnectionError,
} from '../index.ts';

import type {
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

  public async connect() {
    if (this.#isQuitted) {
      throw new SolidisConnectionError(
        'Cannot connect: user quit the connection.',
      );
    }

    if (this.#isConnected && this.#socket) {
      return;
    }

    await this.#acquireConnectLock();
  }

  public cleanup() {
    this.#isConnected = false;

    if (this.#connectTimeout) {
      clearTimeout(this.#connectTimeout);
      this.#connectTimeout = null;
    }

    const socket = this.#socket;

    if (!socket) {
      return;
    }

    this.#socket = null;

    if (socket.destroyed) {
      socket.removeAllListeners();
      socket.unref();

      return;
    }

    socket.end(() => {
      socket.removeAllListeners();
      socket.destroy();
      socket.unref();
    });
  }

  public quit() {
    this.#isQuitted = true;

    this.cleanup();
    this.emit('end');
  }

  public reset() {
    if (this.#connectLock) {
      return;
    }

    const socket = this.#socket;

    if (!socket) {
      return;
    }

    this.#isConnected = false;
    this.#socket = null;

    socket.removeAllListeners();
    socket.on('error', () => {});
    socket.destroy();

    if (this.#isQuitted || !this.#options.autoReconnect) {
      return;
    }

    void this.#tryBackgroundReconnect().catch((error) => {
      this.#debug?.('debug', 'Failed to reset reconnect.', {
        error,
      });
    });
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
            `Connection failed after ${maxConnectionRetries} retries.`,
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

      const { host, port } = this.#options;

      const socket = this.#createSocket({
        host,
        port,
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

    await this.#acquireConnectLock();
  }

  async #acquireConnectLock(): Promise<void> {
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
    onConnect,
  }: {
    host: string;
    port: number;
    onConnect: () => void;
  }): SolidisSocket {
    if (this.#options.tls) {
      return tls.connect({ ...this.#options.tls, host, port }, onConnect);
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

        this.#debug?.('debug', 'Connection closed.');

        this.cleanup();
        this.emit('closed', new SolidisConnectionError('Connection closed.'));

        if (this.#isQuitted) {
          return;
        }

        if (!this.#options?.autoReconnect) {
          return;
        }

        this.#tryBackgroundReconnect().catch((error) => {
          this.#debug?.('debug', 'Failed to background reconnect.', { error });

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
        `Connection timeout (${connectionTimeout} ms).`,
      );

      onTimeout(timeoutError);
    }, connectionTimeout);

    this.#connectTimeout = timer;

    return timer;
  }
}
