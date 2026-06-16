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
import type { RedisClient, RedisConstructor } from '../types.ts';

const require = createRequire(import.meta.url);
const ioredisPackageName = 'ioredis';
const Redis: RedisConstructor = require(ioredisPackageName);

async function createIORedisClient(
  target: ConnectionTarget,
  enableAutoPipelining = true,
): Promise<RedisClient> {
  const client = new Redis({
    host: target.host,
    port: target.port,
    username: target.username,
    password: target.password,
    lazyConnect: true,
    enableReadyCheck: false,
    enableAutoPipelining,
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
    retryStrategy: null,
  });

  client.on('error', () => {});

  await retry('ioredis connect', () => client.connect());

  return client;
}

async function closeIORedisClient(client: RedisClient): Promise<void> {
  client.disconnect();
}

async function cleanupIORedisPrefix(
  client: RedisClient,
  prefix: string,
): Promise<void> {
  let cursor = '0';

  do {
    const reply = await client.scanBuffer(
      cursor,
      'MATCH',
      `${prefix}:*`,
      'COUNT',
      '1000',
    );
    const [nextCursor, keys] = unwrapScanReply(reply);

    cursor = nextCursor;

    for (let index = 0; index < keys.length; index += 500) {
      const chunk = keys.slice(index, index + 500);

      if (chunk.length > 0) {
        await client.unlink(...chunk);
      }
    }
  } while (cursor !== '0');
}

function toIORedisCommandCall(
  command: Command,
): [string, ...CommandArgument[]] {
  const [name, ...arguments_] = command;

  if (typeof name !== 'string') {
    throw new Error(`Redis command name must be a string: ${name}`);
  }

  return [name.toUpperCase(), ...arguments_];
}

function executeIORedisAutoPipelinedCommand(
  client: RedisClient,
  command: Command,
): Promise<unknown> {
  const [name, ...arguments_] = toIORedisCommandCall(command);
  const bufferMethodName = `${name.toLowerCase()}Buffer`;
  const bufferMethod = Reflect.get(client, bufferMethodName);

  if (typeof bufferMethod === 'function') {
    const result: Promise<unknown> = Reflect.apply(
      bufferMethod,
      client,
      arguments_,
    );

    return result;
  }

  return client.call(name, ...arguments_);
}

async function executeIORedisAutoPipelinedCommands(
  client: RedisClient,
  commands: Command[],
): Promise<unknown[]> {
  return await Promise.all(
    commands.map((command) =>
      executeIORedisAutoPipelinedCommand(client, command),
    ),
  );
}

async function executeIORedisBatchCommands(
  client: RedisClient,
  commands: Command[],
): Promise<unknown[]> {
  const pipeline = client.pipeline();

  for (const command of commands) {
    const [name, ...arguments_] = toIORedisCommandCall(command);

    pipeline.callBuffer(name, ...arguments_);
  }

  const results = await pipeline.exec();

  if (!results) {
    throw new Error('ioredis pipeline.exec() returned null');
  }

  return results.map(([, value]) => value);
}

export class IORedisClientAdapter extends BenchmarkClientAdapter {
  readonly name = 'ioredis';

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await createIORedisClient(target, mode === 'autopipeline');

    return {
      async ping() {
        await client.ping();
      },
      async execute(commands) {
        if (mode === 'batch') {
          return await executeIORedisBatchCommands(client, commands);
        }

        return await executeIORedisAutoPipelinedCommands(client, commands);
      },
      cleanup(prefix) {
        return cleanupIORedisPrefix(client, prefix);
      },
      close() {
        return closeIORedisClient(client);
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const client = await createIORedisClient(target);

    return {
      async subscribe(channel) {
        await client.subscribe(channel);
      },
      onMessage(handler) {
        client.on('message', handler);
      },
      close() {
        return closeIORedisClient(client);
      },
    };
  }
}
