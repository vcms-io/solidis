import {
  buildTimeSeriesRangeCommand,
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandTimeSeriesRangeOptions } from '../index.ts';

export function createCommand(
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
  options: CommandTimeSeriesRangeOptions,
) {
  const baseCommand = [
    'TS.REVRANGE',
    key,
    `${fromTimestamp}`,
    `${toTimestamp}`,
  ];

  return buildTimeSeriesRangeCommand(baseCommand, options);
}

export async function tsRevrange<T>(
  this: T,
  key: string,
  fromTimestamp: number,
  toTimestamp: number,
  options: CommandTimeSeriesRangeOptions = {},
): Promise<Array<{ timestamp: number; value: number }>> {
  return await executeCommand(
    this,
    createCommand(key, fromTimestamp, toTimestamp, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((sample) => {
        if (!Array.isArray(sample) || sample.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${sample}`, command);
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
      });
    },
  );
}
