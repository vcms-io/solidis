import {
  executeCommand,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyToString,
  tryReplyTuple,
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
): Promise<
  Array<{ key: string; timestamp: number | null; value: number | null }>
> {
  return await executeCommand(
    this,
    createCommand(filter, options),
    (reply, command) => {
      const series =
        reply instanceof Map
          ? Array.from(reply, ([key, value]) => [
              key,
              ...tryReplyArray(value, command),
            ])
          : tryReplyArray(reply, command);

      return series.map((item) => {
        const fields = tryReplyArray(item, command);
        const key = tryReplyToString(fields[0], command);
        const sample = tryReplyArray(fields.at(-1), command);

        if (sample.length === 0) {
          return { key, timestamp: null, value: null };
        }

        const [timestamp, value] = tryReplyTuple(sample, 2, command);

        return {
          key,
          timestamp: tryReplyToNumber(timestamp, command),
          value: tryReplyToNumber(value, command),
        };
      });
    },
  );
}
