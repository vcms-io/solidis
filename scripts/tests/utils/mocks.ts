/**
 * A minimal, fully scriptable TCP server used by the fragility suite to feed a
 * real {@link SolidisClient} bytes that a well-behaved RESP server would never
 * send: unknown type prefixes, truncated frames, unsolicited replies, or an
 * abrupt mid-stream socket close.
 *
 * The client only reaches `ready` without any server-side handshake bytes when
 * it is constructed with `enableReadyCheck: false` and an empty `clientName`
 * (so neither INFO nor CLIENT SETNAME is issued); see {@link mockClientOptions}.
 */

import net from 'node:net';

import type { SolidisClientOptions } from '../../../sources/index.ts';

export type MockDataHandler = (
  socket: net.Socket,
  data: Buffer,
  server: MockRedisServer,
) => void;

export class MockRedisServer {
  #server: net.Server;
  #port = 0;
  #sockets = new Set<net.Socket>();
  #handler?: MockDataHandler;

  /** Every chunk received from every connection, in arrival order. */
  public readonly received: Buffer[] = [];

  constructor() {
    this.#server = net.createServer((socket) => {
      this.#sockets.add(socket);

      socket.on('data', (data: Buffer) => {
        this.received.push(data);
        this.#handler?.(socket, data, this);
      });

      socket.on('error', () => {
        /** Ignore; tests assert on the client side. */
      });

      socket.on('close', () => {
        this.#sockets.delete(socket);
      });
    });

    this.#server.on('error', () => {
      /** Ignore listen/accept races during teardown. */
    });
  }

  get port(): number {
    return this.#port;
  }

  get connectionCount(): number {
    return this.#sockets.size;
  }

  listen(): Promise<number> {
    return new Promise((resolve) => {
      this.#server.listen(0, '127.0.0.1', () => {
        this.#port = (this.#server.address() as net.AddressInfo).port;
        resolve(this.#port);
      });
    });
  }

  /** Registers (or replaces) the per-chunk response behaviour. */
  onData(handler: MockDataHandler): this {
    this.#handler = handler;

    return this;
  }

  /** Writes raw bytes to every currently connected client socket. */
  send(data: Buffer | string): void {
    const buffer =
      typeof data === 'string' ? Buffer.from(data, 'latin1') : data;

    for (const socket of this.#sockets) {
      socket.write(buffer);
    }
  }

  /** Hard-closes every client socket without a graceful FIN. */
  destroySockets(): void {
    for (const socket of this.#sockets) {
      socket.destroy();
    }

    this.#sockets.clear();
  }

  async close(): Promise<void> {
    this.destroySockets();

    await new Promise<void>((resolve) => {
      this.#server.close(() => resolve());
    });
  }
}

/**
 * Options that let a client connect to a bare mock server and reach `ready`
 * without expecting any handshake bytes back.
 */
export function mockClientOptions(
  port: number,
  overrides: SolidisClientOptions = {},
): SolidisClientOptions {
  return {
    host: '127.0.0.1',
    port,
    clientName: '',
    enableReadyCheck: false,
    autoReconnect: false,
    maxConnectionRetries: 0,
    commandTimeout: 500,
    connectionTimeout: 1000,
    lazyConnect: true,
    ...overrides,
  };
}
