import { SolidisClient } from '../client.ts';
import { SolidisTransactionBannedCommandNames } from '../common/constants.ts';
import { SolidisRequesterError } from '../common/utils/error.ts';
import { appendItems } from '../common/utils/internal.ts';
import { copyCommands, inspectCommand } from '../modules/internal.ts';
import {
  assertSender,
  newCommandError,
  newUnexpectedReplyError,
} from './utils/index.ts';

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
  failedCalls: Promise<unknown>[],
): Promise<SolidisData[] | null> {
  const commands = transactionQueue.splice(0);
  const failures = failedCalls.splice(0);
  const refusal = commands
    .map((command) => inspectCommand(command, true))
    .find((kind) => kind instanceof SolidisRequesterError);

  if (failures.length > 0 || refusal) {
    unwatch(client);

    await Promise.all(failures);

    throw refusal ?? newCommandError('A call queued no command', 'EXEC');
  }

  const replies = await client.send([['MULTI'], ...commands, ['EXEC']]);
  const [[accepted]] = replies;
  const reply = replies[replies.length - 1][0];

  if (accepted instanceof Error) {
    throw newCommandError(accepted.message, 'MULTI', accepted);
  }

  if (reply instanceof Error) {
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
  const failedCalls: Promise<unknown>[] = [];

  assertSender(client, ['MULTI']);

  const queue = (commands: StringOrBuffer[][]) => {
    const batch = copyCommands(commands);

    appendItems(transactionQueue, batch);

    return batch.length > 0
      ? new Promise<never>(() => {})
      : Promise.resolve([]);
  };
  const proxyHandler: ProxyHandler<object> = {
    get(_, property) {
      switch (property) {
        case 'exec': {
          return () => exec(client, transactionQueue, failedCalls);
        }

        case 'discard': {
          return () => {
            transactionQueue.length = 0;
            failedCalls.length = 0;

            unwatch(client);
          };
        }

        default: {
          const method = Reflect.get(client, property);

          if (
            typeof method !== 'function' ||
            property in SolidisClient.prototype ||
            bannedCommandNames.has(property)
          ) {
            return undefined;
          }

          return (...parameters: unknown[]) => {
            const length = transactionQueue.length;
            const { send } = client;

            client.send = queue;

            const call = (async () =>
              Reflect.apply(method, client, parameters))();

            Reflect.deleteProperty(client, 'send');

            if (client.send !== send) {
              client.send = send;
            }

            call.catch(() => {});

            if (transactionQueue.length === length) {
              failedCalls.push(call);
            }
          };
        }
      }
    },
  };

  return new Proxy({}, proxyHandler) as SolidisTransactionClient<T>;
}
