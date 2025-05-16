import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  buildTimeSeriesRangeCommand,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

import type { CommandTimeSeriesRangeOptions } from '../index.ts';

export function createCommand(
  fromTimestamp: number,
  toTimestamp: number,
  filter: Record<string, string>,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = [
    'TS.MRANGE',
    `${fromTimestamp}`,
    `${toTimestamp}`,
    'FILTER',
  ];

  for (const [label, value] of Object.entries(filter)) {
    baseCommand.push(label, '=', value);
  }

  return buildTimeSeriesRangeCommand(baseCommand, options);
}

export async function tsMrange<T>(
  this: T,
  fromTimestamp: number,
  toTimestamp: number,
  filter: Record<string, string>,
  options: CommandTimeSeriesRangeOptions = {},
): Promise<
  Array<{
    key: string;
    samples: Array<{ timestamp: number; value: number }>;
  }>
> {
  return await executeCommand(
    this,
    createCommand(fromTimestamp, toTimestamp, filter, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((item) => {
        if (!Array.isArray(item) || item.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
        }

        const [key, samples] = item;
        if (typeof key !== 'string') {
          throw newCommandError(`${InvalidReplyPrefix}: ${key}`, command);
        }

        if (!Array.isArray(samples)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${samples}`, command);
        }

        return {
          key,
          samples: samples.map((sample) => {
            if (!Array.isArray(sample) || sample.length !== 2) {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${sample}`,
                command,
              );
            }

            const [timestamp, value] = sample;
            if (typeof timestamp !== 'string' || typeof value !== 'string') {
              throw newCommandError(
                `${InvalidReplyPrefix}: ${timestamp}/${value}`,
                command,
              );
            }

            return {
              timestamp: Number(timestamp),
              value: Number(value),
            };
          }),
        };
      });
    },
  );
}
