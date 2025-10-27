import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  tryReplyToStringArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespCommandKeyFlag } from '../index.ts';

export function createCommand(command: string, parameters: string[]) {
  return ['COMMAND', 'GETKEYSANDFLAGS', command, ...parameters];
}

export async function commandGetkeysandflags<T>(
  this: T,
  command: string,
  parameters: string[],
): Promise<RespCommandKeyFlag[]> {
  return await executeCommand(
    this,
    createCommand(command, parameters),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((item) => {
          if (!Array.isArray(item) || item.length !== 2) {
            throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
          }

          const [key, flags] = item;

          if (!(typeof key === 'string' || key instanceof Buffer)) {
            throw newCommandError(`${InvalidReplyPrefix}: ${key}`, command);
          }

          if (!Array.isArray(flags)) {
            throw newCommandError(`${InvalidReplyPrefix}: ${flags}`, command);
          }

          return {
            key: `${key}`,
            flags: tryReplyToStringArray(flags, command),
          };
        });
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
