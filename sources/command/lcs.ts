import { formatInteger } from '../common/utils/internal.ts';
import {
  executeCommand,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToMap,
  tryReplyToString,
} from './utils/index.ts';

import type {
  CommandLCSOptions,
  RespLCSMatch,
  RespLCSMatches,
} from '../index.ts';

export function createCommand(
  key1: string,
  key2: string,
  options?: CommandLCSOptions,
) {
  const command = ['LCS', key1, key2];

  if (options) {
    if (options.len) {
      command.push('LEN');
    }
    if (options.idx) {
      command.push('IDX');
      if (options.minmatchlen !== undefined) {
        command.push('MINMATCHLEN', formatInteger(options.minmatchlen));
      }
      if (options.withmatchlen) {
        command.push('WITHMATCHLEN');
      }
    }
  }

  return command;
}

export async function lcs<T>(
  this: T,
  key1: string,
  key2: string,
  options: CommandLCSOptions & { len: true },
): Promise<number>;
export async function lcs<T>(
  this: T,
  key1: string,
  key2: string,
  options: CommandLCSOptions & { idx: true },
): Promise<RespLCSMatches>;
export async function lcs<T>(
  this: T,
  key1: string,
  key2: string,
  options?: CommandLCSOptions & { len?: false; idx?: false },
): Promise<string>;
export async function lcs<T>(
  this: T,
  key1: string,
  key2: string,
  options?: CommandLCSOptions,
): Promise<string | number | RespLCSMatches>;
export async function lcs<T>(
  this: T,
  key1: string,
  key2: string,
  options?: CommandLCSOptions,
): Promise<string | number | RespLCSMatches> {
  const { len, idx, withmatchlen } = options ?? {};

  return await executeCommand(
    this,
    createCommand(key1, key2, options),
    (reply, command) => {
      if (len) {
        return tryReplyNumber(reply, command);
      }

      if (idx) {
        /**
         * RESP2 returns a flat `['matches', [...], 'len', N]` array; RESP3
         * returns a map keyed by `matches`/`len`. tryReplyToMap reconciles both.
         */
        const map = tryReplyToMap(reply, command);

        const matches = tryReplyArray(map.get('matches'), command).map(
          (matchInfo) => {
            const [first, second, matchLength] = tryReplyArray(
              matchInfo,
              command,
            );
            const [firstStart, firstEnd] = tryReplyArray(first, command);
            const [secondStart, secondEnd] = tryReplyArray(second, command);
            const match: RespLCSMatch = {
              a: [
                tryReplyNumber(firstStart, command),
                tryReplyNumber(firstEnd, command),
              ],
              b: [
                tryReplyNumber(secondStart, command),
                tryReplyNumber(secondEnd, command),
              ],
            };

            if (withmatchlen) {
              match.length = tryReplyNumber(matchLength, command);
            }

            return match;
          },
        );

        return {
          matches,
          length: tryReplyNumber(map.get('len'), command),
        };
      }

      return tryReplyToString(reply, command);
    },
  );
}
