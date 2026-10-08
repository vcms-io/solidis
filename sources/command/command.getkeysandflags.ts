import {
  executeCommand,
  tryReplyArray,
  tryReplyToString,
  tryReplyToStringArray,
  tryReplyTuple,
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
    (reply, commandName) =>
      tryReplyArray(reply, commandName).map((item) => {
        const [key, flags] = tryReplyTuple(item, 2, commandName);

        return {
          key: tryReplyToString(key, commandName),
          flags: tryReplyToStringArray(flags, commandName),
        };
      }),
  );
}
