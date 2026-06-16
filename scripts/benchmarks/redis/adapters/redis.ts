import { createRequire } from 'node:module';

import {
  BenchmarkClientAdapter,
  type PubSubSubscriber,
} from '../../shared/client.ts';
import { retry, unwrapScanReply } from '../../shared/utils.ts';

import type {
  BenchClient,
  BenchmarkMode,
  Command,
  CommandArgument,
  ConnectionTarget,
} from '../../shared/types.ts';

const require = createRequire(import.meta.url);
const redisPackageName = 'redis';
const { createClient, RESP_TYPES }: typeof import('redis') =
  require(redisPackageName);

type NodeRedisClient = Awaited<ReturnType<typeof createNodeRedisClient>>;

async function createNodeRedisClient(target: ConnectionTarget) {
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

async function closeNodeRedisClient(client: NodeRedisClient): Promise<void> {
  try {
    await client.quit();
  } catch {
    client.destroy();
  }
}

async function cleanupNodeRedisPrefix(
  client: NodeRedisClient,
  prefix: string,
): Promise<void> {
  let cursor = '0';

  do {
    const reply = await client.sendCommand([
      'SCAN',
      cursor,
      'MATCH',
      `${prefix}:*`,
      'COUNT',
      '1000',
    ]);
    const [nextCursor, keys] = unwrapScanReply(reply);

    cursor = nextCursor;

    for (let index = 0; index < keys.length; index += 500) {
      const chunk = keys.slice(index, index + 500);

      if (chunk.length > 0) {
        await client.sendCommand(['UNLINK', ...chunk]);
      }
    }
  } while (cursor !== '0');
}

function toRedisArguments(command: Command): CommandArgument[] {
  return [...command];
}

async function executeNodeRedisAutoPipelinedCommands(
  client: NodeRedisClient,
  commands: Command[],
): Promise<unknown[]> {
  return await Promise.all(
    commands.map((command) => client.sendCommand(toRedisArguments(command))),
  );
}

async function executeNodeRedisBatchCommands(
  client: NodeRedisClient,
  commands: Command[],
): Promise<unknown[]> {
  const pipeline = client.multi();

  for (const command of commands) {
    pipeline.sendCommand(toRedisArguments(command));
  }

  const results: unknown[] = await pipeline.execAsPipeline();

  return results;
}

export class NodeRedisClientAdapter extends BenchmarkClientAdapter {
  readonly name = 'node-redis';

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await createNodeRedisClient(target);

    return {
      async ping() {
        await client.ping();
      },
      async execute(commands) {
        if (mode === 'batch') {
          return await executeNodeRedisBatchCommands(client, commands);
        }

        return await executeNodeRedisAutoPipelinedCommands(client, commands);
      },
      cleanup(prefix) {
        return cleanupNodeRedisPrefix(client, prefix);
      },
      close() {
        return closeNodeRedisClient(client);
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const client = await createNodeRedisClient(target);
    let messageHandler: (() => void) | undefined;

    return {
      async subscribe(channel) {
        await client.subscribe(channel, () => {
          messageHandler?.();
        });
      },
      onMessage(handler) {
        messageHandler = handler;
      },
      close() {
        return closeNodeRedisClient(client);
      },
    };
  }
}
