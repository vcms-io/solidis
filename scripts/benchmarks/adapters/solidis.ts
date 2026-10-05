import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SolidisFeaturedClient } from '../../../sources/client/featured.ts';
import {
  BenchmarkClientAdapter,
  type PubSubSubscriber,
  readPackageVersion,
} from '../shared/client.ts';
import { unboundedPipelineLimit } from '../shared/constants.ts';
import { retry, unwrapScanReply } from '../shared/utils.ts';

import type {
  BenchClient,
  BenchmarkMode,
  ConnectionTarget,
} from '../shared/types.ts';

async function connect(target: ConnectionTarget) {
  const client = new SolidisFeaturedClient({
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
  });

  client.on('error', () => {});

  await retry('solidis connect', () => client.connect());

  return client;
}

async function close(client: SolidisFeaturedClient) {
  await new Promise<void>((resolve) => {
    client.once('end', resolve);
    client.quit();
    setTimeout(resolve, 500);
  });
}

class SolidisAdapter extends BenchmarkClientAdapter {
  readonly name = 'solidis';
  readonly packageName = '@vcms-io/solidis';

  get version(): string {
    return readPackageVersion(
      this.packageName,
      dirname(fileURLToPath(import.meta.url)),
    );
  }

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await connect(target);

    return {
      async ping() {
        await client.send([['PING']]);
      },
      async execute(commands) {
        if (mode === 'autopipeline') {
          const results = await Promise.all(
            commands.map((command) => client.send([command])),
          );

          return results.map((replies) => replies[0]?.[0]);
        }

        const results = await client.send(commands);

        return results.map((replies) => replies[0]);
      },
      async cleanup(prefix) {
        let cursor = '0';

        do {
          const [[reply]] = await client.send([
            ['SCAN', cursor, 'MATCH', `${prefix}:*`, 'COUNT', '1000'],
          ]);
          const [nextCursor, keys] = unwrapScanReply(reply);

          cursor = nextCursor;

          for (let index = 0; index < keys.length; index += 500) {
            await client.send([['UNLINK', ...keys.slice(index, index + 500)]]);
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

    return {
      async subscribe(channel) {
        await client.subscribe(channel);
      },
      onMessage(handler) {
        client.on('message', (_channel, message) => handler(message));
      },
      close() {
        return close(client);
      },
    };
  }
}

export const solidisAdapter = new SolidisAdapter();
