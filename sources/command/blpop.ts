import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BLPOP', ...keys, `${timeout}`];
}

export async function blpop<T>(
  this: T,
  keys: string[],
  timeout: number,
): Promise<[string, string] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (Array.isArray(reply) && reply.length === 2) {
        const [key, value] = reply;

        if (
          (typeof key === 'string' || key instanceof Buffer) &&
          (typeof value === 'string' || value instanceof Buffer)
        ) {
          return [`${key}`, `${value}`];
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
