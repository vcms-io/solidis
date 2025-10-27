import {
  executeCommand,
  newCommandError,
  UnexpectedReplyPrefix,
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

      if (!Array.isArray(reply) || reply.length !== 2) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      const [timestamp, value] = reply;

      if (typeof timestamp !== 'string' || typeof value !== 'string') {
        throw newCommandError(
          `${UnexpectedReplyPrefix}: ${timestamp}/${value}`,
          command,
        );
      }

      return [Number(timestamp), Number(value)];
    },
  );
}
