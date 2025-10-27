import {
  buildCuckooFilterInsertCommand,
  executeCommand,
  newCommandError,
  tryReplyToBoolean,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { CommandCuckooFilterInsertOptions } from '../index.ts';

export function createCommand(
  key: string,
  items: string[],
  options?: CommandCuckooFilterInsertOptions,
) {
  return buildCuckooFilterInsertCommand('CF.INSERTNX', key, items, options);
}

export async function cfInsertnx<T>(
  this: T,
  key: string,
  items: string[],
  options?: CommandCuckooFilterInsertOptions,
): Promise<boolean[]> {
  return await executeCommand(
    this,
    createCommand(key, items, options),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((value) => tryReplyToBoolean(value, command));
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
