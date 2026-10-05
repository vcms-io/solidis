import { createRequire } from 'node:module';

import {
  BenchmarkClientAdapter,
  getCommandName,
  type PubSubSubscriber,
} from '../shared/client.ts';
import { retry, unwrapScanReply } from '../shared/utils.ts';

import type {
  BenchClient,
  BenchmarkCase,
  BenchmarkMode,
  BenchmarkNote,
  CommandArgument,
  ConnectionTarget,
} from '../shared/types.ts';

const require = createRequire(import.meta.url);

interface IORedisPipeline {
  callBuffer(
    name: string,
    ...commandArguments: CommandArgument[]
  ): IORedisPipeline;
  exec(): Promise<[Error | null, unknown][] | null>;
}

interface IORedisClient {
  connect(): Promise<void>;
  disconnect(): void;
  ping(): Promise<unknown>;
  call(name: string, ...commandArguments: CommandArgument[]): Promise<unknown>;
  pipeline(): IORedisPipeline;
  scanBuffer(cursor: string, ...options: string[]): Promise<unknown>;
  unlink(...keys: string[]): Promise<unknown>;
  subscribe(channel: string): Promise<unknown>;
  on(event: string, listener: (...values: Buffer[]) => void): unknown;
}

type IORedisConstructor = new (options: object) => IORedisClient;

class IORedisFamilyAdapter extends BenchmarkClientAdapter {
  readonly name: string;
  readonly packageName: string;
  readonly #excludedCommandNames: ReadonlySet<string>;
  readonly #Redis: IORedisConstructor;

  constructor(name: string, packageName: string) {
    super();

    const excluded: string[] = require(
      `${packageName}/built/autoPipelining.js`,
    ).notAllowedAutoPipelineCommands;

    this.name = name;
    this.packageName = packageName;
    this.#excludedCommandNames = new Set(
      excluded.map((commandName) => commandName.toUpperCase()),
    );
    this.#Redis = require(packageName);
  }

  getNonComparableReason(
    benchmarkCase: BenchmarkCase,
    mode: BenchmarkMode,
  ): BenchmarkNote | undefined {
    const excluded = [
      ...new Set(
        benchmarkCase.sampleCommands
          .map(getCommandName)
          .filter((name) => this.#excludedCommandNames.has(name)),
      ),
    ];

    return mode === 'autopipeline' && excluded.length > 0
      ? { kind: 'noAutoPipeline', commands: excluded }
      : undefined;
  }

  async #connect(target: ConnectionTarget, enableAutoPipelining: boolean) {
    const client = new this.#Redis({
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

    await retry(`${this.name} connect`, () => client.connect());

    return client;
  }

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const client = await this.#connect(target, mode === 'autopipeline');

    return {
      async ping() {
        await client.ping();
      },
      async execute(commands) {
        if (mode === 'batch') {
          const pipeline = client.pipeline();

          for (const command of commands) {
            const [, ...commandArguments] = command;

            pipeline.callBuffer(getCommandName(command), ...commandArguments);
          }

          const results = await pipeline.exec();

          if (!results) {
            throw new Error('pipeline.exec() returned null');
          }

          return results.map(([, value]) => value);
        }

        return await Promise.all(
          commands.map((command) => {
            const [, ...commandArguments] = command;
            const name = getCommandName(command);
            const bufferMethod = Reflect.get(
              client,
              `${name.toLowerCase()}Buffer`,
            );

            return typeof bufferMethod === 'function'
              ? Reflect.apply(bufferMethod, client, commandArguments)
              : client.call(name, ...commandArguments);
          }),
        );
      },
      async cleanup(prefix) {
        let cursor = '0';

        do {
          const [nextCursor, keys] = unwrapScanReply(
            await client.scanBuffer(
              cursor,
              'MATCH',
              `${prefix}:*`,
              'COUNT',
              '1000',
            ),
          );

          cursor = nextCursor;

          for (let index = 0; index < keys.length; index += 500) {
            await client.unlink(...keys.slice(index, index + 500));
          }
        } while (cursor !== '0');
      },
      async close() {
        client.disconnect();
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const client = await this.#connect(target, true);

    return {
      async subscribe(channel) {
        await client.subscribe(channel);
      },
      onMessage(handler) {
        client.on('messageBuffer', (_channel: Buffer, message: Buffer) =>
          handler(message),
        );
      },
      async close() {
        client.disconnect();
      },
    };
  }
}

export const ioredisAdapter = new IORedisFamilyAdapter('ioredis', 'ioredis');
export const iovalkeyAdapter = new IORedisFamilyAdapter('iovalkey', 'iovalkey');
