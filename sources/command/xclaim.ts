import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToStreamEntries,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { RespStreamEntry, XclaimOptions } from '../index.ts';

export type { XclaimOptions };

export function createCommand(
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  ids: string[],
  options?: XclaimOptions,
) {
  const command = [
    'XCLAIM',
    key,
    group,
    consumer,
    formatInteger(minIdleTime),
    ...ids,
  ];

  if (options?.idle !== undefined) {
    command.push('IDLE', formatInteger(options.idle));
  }

  if (options?.time !== undefined) {
    command.push('TIME', formatInteger(options.time));
  }

  if (options?.retrycount !== undefined) {
    command.push('RETRYCOUNT', formatInteger(options.retrycount));
  }

  if (options?.force) {
    command.push('FORCE');
  }

  if (options?.justid) {
    command.push('JUSTID');
  }

  return command;
}

export async function xclaim<T>(
  this: T,
  key: string,
  group: string,
  consumer: string,
  minIdleTime: number,
  ids: string[],
  options?: XclaimOptions,
): Promise<RespStreamEntry[] | string[]> {
  return await executeCommand(
    this,
    createCommand(key, group, consumer, minIdleTime, ids, options),
    (reply, command, replyOptions) => {
      if (replyOptions?.justid) {
        return tryReplyToStringArray(reply, command);
      }

      return tryReplyToStreamEntries(reply, command);
    },
    options,
  );
}
