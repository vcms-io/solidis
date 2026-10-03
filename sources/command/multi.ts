import { RespError } from '../common/utils/error.ts';
import {
  assertSender,
  newCommandError,
  newUnexpectedReplyError,
  SolidisTransactionQueues,
} from './utils/index.ts';

import type { SolidisClient } from '../client.ts';
import type {
  SolidisData,
  SolidisTransactionClient,
  StringOrBuffer,
} from '../index.ts';

async function exec(
  client: Pick<SolidisClient, 'send'>,
  transactionQueue: StringOrBuffer[][],
  commandPromises: Promise<unknown>[],
): Promise<SolidisData[] | null> {
  const results = await Promise.allSettled(commandPromises);
  const rejected = results.find((result) => result.status === 'rejected');
  const commands = transactionQueue.splice(0);

  commandPromises.length = 0;

  if (rejected && rejected.status === 'rejected') {
    throw rejected.reason;
  }

  if (commands.length < 1) {
    return [];
  }

  const replies = await client.send([['MULTI'], ...commands, ['EXEC']]);
  const reply = replies[replies.length - 1][0];

  if (reply instanceof RespError) {
    throw newCommandError(reply.message, 'EXEC', reply);
  }

  if (reply !== null && !Array.isArray(reply)) {
    throw newUnexpectedReplyError(reply, 'EXEC');
  }

  return reply;
}

export function multi<T extends object>(this: T): SolidisTransactionClient<T> {
  const client = this;
  const transactionQueue: StringOrBuffer[][] = [];
  const commandPromises: Promise<unknown>[] = [];

  assertSender(client, ['MULTI']);

  const proxyHandler: ProxyHandler<object> = {
    get(_, property) {
      switch (property) {
        case 'exec': {
          return () => exec(client, transactionQueue, commandPromises);
        }

        case 'discard': {
          return () => {
            transactionQueue.length = 0;
            commandPromises.length = 0;
          };
        }

        default: {
          const method = Reflect.get(client, property);

          if (typeof method !== 'function' || property === 'reset') {
            return undefined;
          }

          return (...parameters: unknown[]) => {
            SolidisTransactionQueues.set(client, transactionQueue);

            try {
              const promise = Promise.resolve(
                Reflect.apply(method, client, parameters),
              );

              commandPromises.push(promise);
              promise.catch(() => {});
            } finally {
              SolidisTransactionQueues.delete(client);
            }
          };
        }
      }
    },
  };

  return new Proxy({}, proxyHandler) as SolidisTransactionClient<T>;
}
