import {
  executeCommand,
  newCommandError,
  tryReplyNumber,
  tryReplyToString,
  UnexpectedReplyPrefix,
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
        if (Array.isArray(reply)) {
          const matches: RespLCSMatch[] = [];

          const matchesData = reply[1];

          if (Array.isArray(matchesData)) {
            for (const matchInfo of matchesData) {
              if (Array.isArray(matchInfo)) {
                const [pos1, pos2, len] = matchInfo;
                if (Array.isArray(pos1) && Array.isArray(pos2)) {
                  const match: RespLCSMatch = {
                    a: [Number(pos1[0]), Number(pos1[1])],
                    b: [Number(pos2[0]), Number(pos2[1])],
                  };
                  if (options.withmatchlen && typeof len === 'number') {
                    match.length = len;
                  }
                  matches.push(match);
                }
              }
            }
          }

          const length = reply[reply.length - 1];

          return {
            matches,
            length: Number(length),
          };
        }

        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return tryReplyToString(reply, command);
    },
  );
}
