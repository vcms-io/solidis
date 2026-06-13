import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandTimeSeriesMGetOptions } from '../index.ts';

export function createCommand(
  filter: Record<string, string>,
  options: CommandTimeSeriesMGetOptions,
) {
  const command: string[] = ['TS.MGET'];

  if (options.latest) {
    command.push('LATEST');
  }

  if (options.filterByValue?.length) {
    for (const [min, max] of options.filterByValue) {
      command.push('FILTER_BY_VALUE', `${min}`, `${max}`);
    }
  }

  command.push('FILTER');

  for (const [label, value] of Object.entries(filter)) {
    command.push(`${label}=${value}`);
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
      if (reply instanceof Map) {
        const results: Array<{
          key: string;
          timestamp: number;
          value: number;
        }> = [];

        for (const [key, value] of reply) {
          if (!Array.isArray(value)) {
            throw newCommandError(`${InvalidReplyPrefix}: ${value}`, command);
          }

          const sample = value[value.length - 1];

          if (!Array.isArray(sample) || sample.length !== 2) {
            throw newCommandError(`${InvalidReplyPrefix}: ${sample}`, command);
          }

          results.push({
            key: `${key}`,
            timestamp: Number(sample[0]),
            value: Number(sample[1]),
          });
        }

        return results;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((item) => {
        if (!Array.isArray(item) || item.length < 3) {
          throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
        }

        const key = item[0];
        const sample = item[item.length - 1];

        if (typeof key !== 'string' && !(key instanceof Buffer)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${key}`, command);
        }

        if (!Array.isArray(sample) || sample.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${sample}`, command);
        }

        return {
          key: `${key}`,
          timestamp: Number(sample[0]),
          value: Number(sample[1]),
        };
      });
    },
  );
}
