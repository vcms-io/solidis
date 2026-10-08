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

const listeningServers = new Set<MockRedisServer>();

export class MockRedisServer {
  #server: net.Server;
  #port = 0;
  #sockets = new Set<net.Socket>();
  #handler?: MockDataHandler;
  #acceptedCount = 0;

  /** Destroys every new connection as soon as it is accepted. */
  public closesOnAccept = false;

  /** Every chunk received from every connection, in arrival order. */
  public readonly received: Buffer[] = [];

  constructor() {
    this.#server = net.createServer((socket) => {
      this.#acceptedCount += 1;

      if (this.closesOnAccept) {
        socket.destroy();

        return;
      }

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

  /** Every connection accepted so far, including the ones already closed. */
  get acceptedCount(): number {
    return this.#acceptedCount;
  }

  listen(port = 0): Promise<number> {
    listeningServers.add(this);

    return new Promise((resolve, reject) => {
      this.#server.once('error', reject);
      this.#server.listen(port, '127.0.0.1', () => {
        this.#server.off('error', reject);
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

  /** Destroys every client socket at once. */
  destroySockets(): void {
    for (const socket of this.#sockets) {
      socket.destroy();
    }

    this.#sockets.clear();
  }

  async close(): Promise<void> {
    listeningServers.delete(this);
    this.destroySockets();

    await new Promise<void>((resolve) => {
      this.#server.close(() => resolve());
    });
  }
}

/** Closes every mock server a test left listening, also after a failure. */
export async function closeAllServers(): Promise<void> {
  await Promise.all(
    Array.from(listeningServers).map((server) => server.close()),
  );
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
