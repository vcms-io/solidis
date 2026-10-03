import { SolidisTransactionBannedCommandNames } from '../common/constants.ts';
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

const bannedCommandNames: ReadonlySet<unknown> = new Set(
  SolidisTransactionBannedCommandNames,
);

function unwatch(client: Pick<SolidisClient, 'send'>) {
  client.send([['UNWATCH']]).catch(() => {});
}

async function exec(
  client: Pick<SolidisClient, 'send'>,
  transactionQueue: StringOrBuffer[][],
  commandPromises: Promise<unknown>[],
): Promise<SolidisData[] | null> {
  const results = await Promise.allSettled(commandPromises);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  const commands = transactionQueue.splice(0);

  commandPromises.length = 0;

  if (rejected) {
    unwatch(client);

    throw rejected.reason;
  }

  const replies = await client.send([['MULTI'], ...commands, ['EXEC']]);
  const [[accepted]] = replies;
  const reply = replies[replies.length - 1][0];

  if (accepted instanceof RespError) {
    throw newCommandError(accepted.message, 'MULTI', accepted);
  }

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

            unwatch(client);
          };
        }

        default: {
          const method = Reflect.get(client, property);

          if (
            typeof method !== 'function' ||
            !Object.hasOwn(client, property) ||
            bannedCommandNames.has(property) ||
            Reflect.get(method, Symbol.toStringTag) === 'AsyncGeneratorFunction'
          ) {
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
