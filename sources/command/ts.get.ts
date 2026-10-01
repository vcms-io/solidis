import {
  executeCommand,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyTuple,
} from './utils/index.ts';

export function createCommand(key: string, latest?: boolean) {
  const command = ['TS.GET', key];

  if (latest) {
    command.push('LATEST');
  }

  return command;
}

export async function tsGet<T>(
  this: T,
  key: string,
  latest?: boolean,
): Promise<[number, number] | null> {
  return await executeCommand(
    this,
    createCommand(key, latest),
    (reply, command) => {
      if (tryReplyArray(reply, command).length === 0) {
        return null;
      }

      const [timestamp, value] = tryReplyTuple(reply, 2, command);

      return [
        tryReplyToNumber(timestamp, command),
        tryReplyToNumber(value, command),
      ];
    },
  );
}
