import { pipeline } from './pipeline.ts';
import { newCommandError } from './utils/index.ts';

import type {
  SolidisClient,
  SolidisClientExtensions,
  SolidisTransactionClient,
  StringOrBuffer,
} from '../index.ts';

const SolidisExtensions: {
  pipeline: typeof pipeline;
  pipeQueue?: StringOrBuffer[][];
} = {
  pipeline,
  pipeQueue: [],
} satisfies SolidisClientExtensions;

function guard(thisValue: object): asserts thisValue is SolidisClient {
  if (!('extend' in thisValue) || typeof thisValue.extend !== 'function') {
    throw newCommandError('Extend method is not implemented', 'MULTI');
  }
}

function clearPipeline(commands: StringOrBuffer[][]) {
  commands.splice(0, commands.length);
}

export function multi<T extends object>(this: T): SolidisTransactionClient<T> {
  const pipeQueue: StringOrBuffer[][] = [];

  guard(this);

  const client = this.extend(SolidisExtensions);

  const proxyHandler: ProxyHandler<T> = {
    get(_, property) {
      switch (property) {
        case 'exec': {
          return async () => {
            if (pipeQueue.length < 1) {
              return [];
            }

            const pipelined = client.pipeline([
              ['MULTI'],
              ...pipeQueue,
              ['EXEC'],
            ]);

            clearPipeline(pipeQueue);

            return await pipelined;
          };
        }

        case 'discard': {
          return () => {
            if (pipeQueue.length < 1) {
              return;
            }

            clearPipeline(pipeQueue);
          };
        }

        default: {
          const method = client[property as keyof T];

          if (typeof method === 'function') {
            return (...parameters: unknown[]) => {
              try {
                client.pipeQueue = pipeQueue;

                method(...parameters).catch(() => {});
              } finally {
                client.pipeQueue = undefined;
              }
            };
          }

          return undefined;
        }
      }
    },
  };

  return new Proxy({}, proxyHandler) as SolidisTransactionClient<T>;
}
