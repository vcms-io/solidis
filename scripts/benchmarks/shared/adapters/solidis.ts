import { SolidisFeaturedClient } from '../../../../sources/client/featured.ts';
import { BenchmarkClientAdapter, type PubSubSubscriber } from '../client.ts';
import {
  unboundedPipelineLimit,
  unboundedReplyProcessingLimit,
  unboundedSocketWriteSize,
} from '../constants.ts';
import { retry, unwrapScanReply } from '../utils.ts';

import type { SolidisClientOptions } from '../../../../sources/index.ts';
import type {
  BenchClient,
  BenchmarkMode,
  Command,
  ConnectionTarget,
} from '../types.ts';

function makeSolidisOptions(target: ConnectionTarget): SolidisClientOptions {
  return {
    host: target.host,
    port: target.port,
    authentication:
      target.username || target.password
        ? { username: target.username, password: target.password }
        : undefined,
    lazyConnect: true,
    enableReadyCheck: false,
    autoReconnect: false,
    connectionTimeout: 10000,
    commandTimeout: 0,
    maxCommandsPerPipeline: unboundedPipelineLimit,
    maxSocketWriteSizePerOnce: unboundedSocketWriteSize,
    maxProcessReplyBytesPerChunk: unboundedReplyProcessingLimit,
    maxProcessRepliesPerChunk: unboundedReplyProcessingLimit,
  };
}

async function createSolidisClient(
  target: ConnectionTarget,
): Promise<SolidisFeaturedClient> {
  const client = new SolidisFeaturedClient(makeSolidisOptions(target));

  client.on('error', () => {});

  await retry('solidis connect', () => client.connect());

  return client;
}

async function closeSolidisClient(
  client: SolidisFeaturedClient,
): Promise<void> {
  await new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }

      settled = true;
      resolve();
    };

    client.once('end', finish);
    client.quit();
    setTimeout(finish, 500);
  });
}

async function cleanupSolidisPrefix(
  client: SolidisFeaturedClient,
  prefix: string,
): Promise<void> {
  let cursor = '0';

  do {
    const reply = await client.send([
      ['SCAN', cursor, 'MATCH', `${prefix}:*`, 'COUNT', '1000'],
    ]);
    const [nextCursor, keys] = unwrapScanReply(reply[0]?.[0]);

    cursor = nextCursor;

    for (let index = 0; index < keys.length; index += 500) {
      const chunk = keys.slice(index, index + 500);

      if (chunk.length > 0) {
        await client.send([['UNLINK', ...chunk]]);
      }
    }
  } while (cursor !== '0');
}

export class SolidisClientAdapter extends BenchmarkClientAdapter {
  readonly name = 'solidis';

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await createSolidisClient(target);

    return {
      async ping() {
        await client.send([['PING']]);
      },
      async execute(commands: Command[]) {
        if (mode === 'autopipeline') {
          const results = await Promise.all(
            commands.map((command) => client.send([command])),
          );

          return results.map((subReply) => subReply[0]?.[0]);
        }

        const results = await client.send(commands);

        return results.map((subReply) => subReply[0]);
      },
      cleanup(prefix) {
        return cleanupSolidisPrefix(client, prefix);
      },
      close() {
        return closeSolidisClient(client);
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const client = await createSolidisClient(target);

    return {
      async subscribe(channel) {
        await client.subscribe(channel);
      },
      onMessage(handler) {
        client.on('message', handler);
      },
      close() {
        return closeSolidisClient(client);
      },
    };
  }
}
