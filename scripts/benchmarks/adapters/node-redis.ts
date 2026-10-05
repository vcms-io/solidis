import { createRequire } from 'node:module';

import {
  BenchmarkClientAdapter,
  type PubSubSubscriber,
} from '../shared/client.ts';
import { retry, unwrapScanReply } from '../shared/utils.ts';

import type {
  BenchClient,
  BenchmarkMode,
  ConnectionTarget,
} from '../shared/types.ts';

const require = createRequire(import.meta.url);
const { createClient, RESP_TYPES }: typeof import('redis') = require('redis');

async function connect(target: ConnectionTarget) {
  const client = createClient({
    RESP: 2,
    commandOptions: {
      timeout: 0,
      typeMapping: {
        [RESP_TYPES.BLOB_STRING]: Buffer,
      },
    },
    disableClientInfo: true,
    disableOfflineQueue: false,
    password: target.password,
    socket: {
      connectTimeout: 10000,
      host: target.host,
      port: target.port,
      reconnectStrategy: false,
    },
    username: target.username,
  });

  client.on('error', () => {});

  return await retry('node-redis connect', () => client.connect());
}

type NodeRedisClient = Awaited<ReturnType<typeof connect>>;

async function close(client: NodeRedisClient) {
  try {
    await client.quit();
  } catch {
    client.destroy();
  }
}

class NodeRedisAdapter extends BenchmarkClientAdapter {
  readonly name = 'node-redis';
  readonly packageName = 'redis';

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await connect(target);

    return {
      async ping() {
        await client.ping();
      },
      async execute(commands) {
        if (mode === 'batch') {
          const pipeline = client.multi();

          for (const command of commands) {
            pipeline.sendCommand([...command]);
          }

          const results: unknown[] = await pipeline.execAsPipeline();

          return results;
        }

        return await Promise.all(
          commands.map((command) => client.sendCommand([...command])),
        );
      },
      async cleanup(prefix) {
        let cursor = '0';

        do {
          const [nextCursor, keys] = unwrapScanReply(
            await client.sendCommand([
              'SCAN',
              cursor,
              'MATCH',
              `${prefix}:*`,
              'COUNT',
              '1000',
            ]),
          );

          cursor = nextCursor;

          for (let index = 0; index < keys.length; index += 500) {
            await client.sendCommand([
              'UNLINK',
              ...keys.slice(index, index + 500),
            ]);
          }
        } while (cursor !== '0');
      },
      close() {
        return close(client);
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const client = await connect(target);
    let messageHandler: ((message: unknown) => void) | undefined;

    return {
      async subscribe(channel) {
        await client.subscribe(
          channel,
          (message: Buffer) => {
            messageHandler?.(message);
          },
          true,
        );
      },
      onMessage(handler) {
        messageHandler = handler;
      },
      close() {
        return close(client);
      },
    };
  }
}

export const nodeRedisAdapter = new NodeRedisAdapter();
