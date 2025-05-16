import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

import type { CommandTimeSeriesMGetOptions } from '../index.ts';

export function createCommand(
  filter: Record<string, string>,
  options: CommandTimeSeriesMGetOptions,
) {
  const command = ['TS.MGET', 'FILTER'];

  for (const [label, value] of Object.entries(filter)) {
    command.push(label, '=', value);
  }

  if (options.latest) {
    command.push('LATEST');
  }

  if (options.filterByValue?.length) {
    for (const [min, max] of options.filterByValue) {
      command.push('FILTER_BY_VALUE', `${min}`, `${max}`);
    }
  }

  return command;
}

export async function tsMget<T>(
  this: T,
  filter: Record<string, string>,
  options: CommandTimeSeriesMGetOptions = {},
): Promise<Array<{ key: string; timestamp: number; value: number }>> {
  return await executeCommand(
    this,
    createCommand(filter, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((item) => {
        if (!Array.isArray(item) || item.length !== 3) {
          throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
        }

        const [key, timestamp, value] = item;
        if (
          typeof key !== 'string' ||
          typeof timestamp !== 'string' ||
          typeof value !== 'string'
        ) {
          throw newCommandError(
            `${InvalidReplyPrefix}: ${key}/${timestamp}/${value}`,
            command,
          );
        }

        return {
          key,
          timestamp: Number(timestamp),
          value: Number(value),
        };
      });
    },
  );
}
