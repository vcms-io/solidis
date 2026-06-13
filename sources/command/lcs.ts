import {
  executeCommand,
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
        command.push('MINMATCHLEN', `${options.minmatchlen}`);
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
  options?: CommandLCSOptions,
): Promise<string | number | RespLCSMatches> {
  return await executeCommand(
    this,
    createCommand(key1, key2, options),
    (reply, command) => {
      if (options?.len) {
        return tryReplyNumber(reply, command);
      }

      if (options?.idx) {
        /**
         * RESP2 returns a flat `['matches', [...], 'len', N]` array; RESP3
         * returns a map keyed by `matches`/`len`. tryReplyToMap reconciles both.
         */
        const map = tryReplyToMap(reply, command);

        const matches: RespLCSMatch[] = [];
        const matchesData = map.get('matches');

        if (Array.isArray(matchesData)) {
          for (const matchInfo of matchesData) {
            if (Array.isArray(matchInfo)) {
              const [position1, position2, matchLength] = matchInfo;
              if (Array.isArray(position1) && Array.isArray(position2)) {
                const match: RespLCSMatch = {
                  a: [Number(position1[0]), Number(position1[1])],
                  b: [Number(position2[0]), Number(position2[1])],
                };
                if (options.withmatchlen && typeof matchLength === 'number') {
                  match.length = matchLength;
                }
                matches.push(match);
              }
            }
          }
        }

        return {
          matches,
          length: Number(map.get('len')),
        };
      }

      return tryReplyToString(reply, command);
    },
  );
}
