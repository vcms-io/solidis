import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyArray,
  tryReplyToNumber,
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
      if (reply === null) {
        return null;
      }

      const sample = tryReplyArray(reply, command);

      if (sample.length === 0) {
        return null;
      }

      if (sample.length !== 2) {
        throw newUnexpectedReplyError(reply, command);
      }

      return [
        tryReplyToNumber(sample[0], command),
        tryReplyToNumber(sample[1], command),
      ];
    },
  );
}
