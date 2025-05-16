import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
  tryReplyToBoolean,
} from './utils/index.ts';

export function createCommand(key: string, items: string[]) {
  return ['CF.MEXISTS', key, ...items];
}

export async function cfMexists<T>(
  this: T,
  key: string,
  items: string[],
): Promise<(number | boolean)[]> {
  return await executeCommand(
    this,
    createCommand(key, items),
    (reply, command) => {
      if (Array.isArray(reply)) {
        return reply.map((value) => tryReplyToBoolean(value, command));
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
