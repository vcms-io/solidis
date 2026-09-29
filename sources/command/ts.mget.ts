import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyToString,
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
        const sample = tryReplyArray(fields.at(-1), command);

        if (fields.length < 2 || (sample.length !== 0 && sample.length !== 2)) {
          throw newUnexpectedReplyError(item, command);
        }

        return {
          key: tryReplyToString(fields[0], command),
          timestamp:
            sample.length === 0 ? null : tryReplyToNumber(sample[0], command),
          value:
            sample.length === 0 ? null : tryReplyToNumber(sample[1], command),
        };
      });
    },
  );
}
