import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type {
  RespStreamPendingEntry,
  RespStreamPendingInfo,
} from '../index.ts';

export function createCommand(
  key: string,
  group: string,
  start?: string,
  end?: string,
  count?: number,
  consumer?: string,
  idleTime?: number,
) {
  const command = ['XPENDING', key, group];

  if (start !== undefined) {
    if (idleTime !== undefined) {
      command.push('IDLE', `${idleTime}`);
    }

    command.push(start, end ?? '+', count === undefined ? '10' : `${count}`);

    if (consumer !== undefined) {
      command.push(consumer);
    }
  }

  return command;
}

export async function xpending<T>(
  this: T,
  key: string,
  group: string,
  start?: string,
  end?: string,
  count?: number,
  consumer?: string,
  idleTime?: number,
): Promise<RespStreamPendingInfo | RespStreamPendingEntry[]> {
  return await executeCommand(
    this,
    createCommand(key, group, start, end, count, consumer, idleTime),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      if (start === undefined) {
        if (reply.length !== 4) {
          throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, command);
        }

        const [pending, minId, maxId, consumers] = reply;

        if (!Array.isArray(consumers)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${consumers}`, command);
        }

        return {
          pending: Number(pending),
          minId: String(minId),
          maxId: String(maxId),
          consumers: consumers.map((consumer) => {
            if (!Array.isArray(consumer) || consumer.length !== 2) {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${consumer}`,
                command,
              );
            }

            const [name, count] = consumer;

            return {
              name: String(name),
              count: Number(count),
            };
          }),
        };
      }

      return reply.map((entry): RespStreamPendingEntry => {
        if (!Array.isArray(entry) || entry.length !== 4) {
          throw newCommandError(`${InvalidReplyPrefix}: ${entry}`, command);
        }

        const [id, consumer, deliveryTime, deliveryCount] = entry;

        return {
          id: String(id),
          consumer: String(consumer),
          deliveryTime: Number(deliveryTime),
          deliveryCount: Number(deliveryCount),
        };
      });
    },
  );
}
