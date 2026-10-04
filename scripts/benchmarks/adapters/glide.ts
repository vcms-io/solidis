import { createRequire } from 'node:module';

import {
  BenchmarkClientAdapter,
  type PubSubSubscriber,
} from '../shared/client.ts';
import { retry, unwrapScanReply } from '../shared/utils.ts';

import type {
  BenchClient,
  BenchmarkCase,
  BenchmarkMode,
  BenchmarkNote,
  Command,
  CommandArgument,
  ConnectionTarget,
} from '../shared/types.ts';

const require = createRequire(import.meta.url);

interface GlideBatch {
  customCommand(commandArguments: CommandArgument[]): GlideBatch;
}

interface GlideClient {
  customCommand(commandArguments: CommandArgument[]): Promise<unknown>;
  exec(batch: GlideBatch, raiseOnError: boolean): Promise<unknown[] | null>;
  close(): void;
}

interface GlideModule {
  GlideClient: {
    createClient(configuration: object): Promise<GlideClient>;
  };
  GlideClientConfiguration: { PubSubChannelModes: { Exact: number } };
  Batch: new (isAtomic: boolean) => GlideBatch;
  Decoder: { Bytes: number };
  ProtocolVersion: { RESP2: number; RESP3: number };
  Logger: { setLoggerConfig(level: 'off'): void };
}

function isTransactionCommand(command: Command) {
  return command[0] === 'MULTI' || command[0] === 'EXEC';
}

class GlideFamilyAdapter extends BenchmarkClientAdapter {
  readonly name: string;
  readonly packageName: string;
  readonly hasNativeCore = true;
  readonly #sendsRawTransactions: boolean;
  #module: GlideModule | undefined;

  constructor(
    name: string,
    packageName: string,
    sendsRawTransactions: boolean,
  ) {
    super();

    this.name = name;
    this.packageName = packageName;
    this.#sendsRawTransactions = sendsRawTransactions;
  }

  #load(): GlideModule {
    if (!this.#module) {
      const glide: GlideModule = require(this.packageName);

      glide.Logger.setLoggerConfig('off');
      this.#module = glide;
    }

    return this.#module;
  }

  getNonComparableReason(
    benchmarkCase: BenchmarkCase,
    mode: BenchmarkMode,
  ): BenchmarkNote | undefined {
    if (benchmarkCase.sampleCommands.some(([name]) => name === 'PUBLISH')) {
      return { kind: 'resp3PubSub' };
    }

    if (
      !this.#sendsRawTransactions &&
      benchmarkCase.sampleCommands.some(isTransactionCommand)
    ) {
      return { kind: 'atomicTransactions' };
    }

    return mode === 'autopipeline' && benchmarkCase.commandsPerUnit > 1
      ? { kind: 'batchedOperations' }
      : undefined;
  }

  getUnavailableReason(): string | undefined {
    try {
      this.#load();

      return undefined;
    } catch (error) {
      return `${this.packageName} does not load on ${process.platform} ${process.arch}: ${error instanceof Error ? error.message.split('\n')[0] : error}`;
    }
  }

  async #connect(target: ConnectionTarget, subscription?: object) {
    const { GlideClient, Decoder, ProtocolVersion } = this.#load();

    return await retry(`${this.name} connect`, () =>
      GlideClient.createClient({
        addresses: [{ host: target.host, port: target.port }],
        credentials: target.password
          ? { username: target.username, password: target.password }
          : undefined,
        protocol: subscription ? ProtocolVersion.RESP3 : ProtocolVersion.RESP2,
        defaultDecoder: Decoder.Bytes,
        requestTimeout: 600_000,
        inflightRequestsLimit: 1_000_000,
        advancedConfiguration: { connectionTimeout: 10000 },
        pubsubSubscriptions: subscription,
      }),
    );
  }

  async createBenchClient(
    target: ConnectionTarget,
    mode: BenchmarkMode,
  ): Promise<BenchClient> {
    const { Batch } = this.#load();
    const client = await this.#connect(target);
    const sendBatch = async (commands: Command[], isAtomic: boolean) => {
      const batch = new Batch(isAtomic);

      for (const command of commands) {
        batch.customCommand(command);
      }

      return await client.exec(batch, false);
    };
    const sendTransaction = async (commands: Command[]) => {
      const multi = commands.findIndex(([name]) => name === 'MULTI');
      const exec = commands.findIndex(([name]) => name === 'EXEC');
      const queued = commands.slice(multi + 1, exec);
      const before =
        multi > 0 ? await sendBatch(commands.slice(0, multi), false) : [];

      return [
        ...(before ?? []),
        'OK',
        ...queued.map(() => 'QUEUED'),
        await sendBatch(queued, true),
      ];
    };
    const sendsRawTransactions = this.#sendsRawTransactions;

    return {
      async ping() {
        await client.customCommand(['PING']);
      },
      async execute(commands) {
        if (!sendsRawTransactions && commands.some(isTransactionCommand)) {
          return await sendTransaction(commands);
        }

        if (mode === 'batch' || commands.length > 1) {
          return (await sendBatch(commands, false)) ?? [];
        }

        return await Promise.all(
          commands.map((command) => client.customCommand(command)),
        );
      },
      async cleanup(prefix) {
        let cursor = '0';

        do {
          const [nextCursor, keys] = unwrapScanReply(
            await client.customCommand([
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
            await client.customCommand([
              'UNLINK',
              ...keys.slice(index, index + 500),
            ]);
          }
        } while (cursor !== '0');
      },
      async close() {
        client.close();
      },
    };
  }

  async createPubSubSubscriber(
    target: ConnectionTarget,
  ): Promise<PubSubSubscriber> {
    const { GlideClientConfiguration } = this.#load();
    let client: GlideClient | undefined;
    let messageHandler: (() => void) | undefined;

    return {
      subscribe: async (channel) => {
        client = await this.#connect(target, {
          channelsAndPatterns: {
            [GlideClientConfiguration.PubSubChannelModes.Exact]: new Set([
              channel,
            ]),
          },
          callback: () => messageHandler?.(),
        });
      },
      onMessage(handler) {
        messageHandler = handler;
      },
      async close() {
        client?.close();
      },
    };
  }
}

export const valkeyGlideAdapter = new GlideFamilyAdapter(
  'valkey-glide',
  '@valkey/valkey-glide',
  false,
);
export const speedkeyAdapter = new GlideFamilyAdapter(
  'speedkey',
  '@glidemq/speedkey',
  true,
);
