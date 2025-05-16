import {
  executeCommand,
  tryReplyToStringArray,
  tryReplyToStringOrNull,
} from './utils/index.ts';

export function createCommand(key: string, count?: number) {
  const command = ['SRANDMEMBER', key];

  if (count !== undefined) {
    command.push(`${count}`);
  }

  return command;
}

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
