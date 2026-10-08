import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyToSortedSetMembers,
  tryReplyToString,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { RespSortedSetMember } from '../index.ts';

export function createCommand(
  key: string,
  count?: number,
  withScores?: boolean,
) {
  const command = ['ZRANDMEMBER', key];

  if (count !== undefined || withScores) {
    command.push(formatInteger(count ?? 1));
  }

  if (withScores) {
    command.push('WITHSCORES');
  }

  return command;
}

export async function zrandmember<T>(
  this: T,
  key: string,
): Promise<string | null>;
export async function zrandmember<T>(
  this: T,
  key: string,
  count: number,
  withScores?: false,
): Promise<string[]>;
export async function zrandmember<T>(
  this: T,
  key: string,
  count: number | undefined,
  withScores: true,
): Promise<RespSortedSetMember[]>;
export async function zrandmember<T>(
  this: T,
  key: string,
  count?: number,
  withScores?: boolean,
): Promise<string | string[] | RespSortedSetMember[] | null>;
export async function zrandmember<T>(
  this: T,
  key: string,
  count?: number,
  withScores?: boolean,
): Promise<string | string[] | RespSortedSetMember[] | null> {
  return await executeCommand(
    this,
    createCommand(key, count, withScores),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (withScores) {
        return tryReplyToSortedSetMembers(reply, command);
      }

      if (count === undefined) {
        return tryReplyToString(reply, command);
      }

      return tryReplyToStringArray(reply, command);
    },
  );
}
