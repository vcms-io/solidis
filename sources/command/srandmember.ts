import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToStringArray,
  tryReplyToStringOrNull,
} from './utils/index.ts';

export function createCommand(key: string, count?: number) {
  const command = ['SRANDMEMBER', key];

  if (count !== undefined) {
    command.push(formatInteger(count));
  }

  return command;
}

export async function srandmember<T>(
  this: T,
  key: string,
): Promise<string | null>;
export async function srandmember<T>(
  this: T,
  key: string,
  count: number,
): Promise<string[]>;
export async function srandmember<T>(
  this: T,
  key: string,
  count?: number,
): Promise<string | string[] | null>;
export async function srandmember<T>(
  this: T,
  key: string,
  count?: number,
): Promise<string | string[] | null> {
  return await executeCommand(
    this,
    createCommand(key, count),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return tryReplyToStringArray(reply, command);
      }

      return tryReplyToStringOrNull(reply, command);
    },
  );
}
