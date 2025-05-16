import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BZPOPMIN', ...keys, `${timeout}`];
}

export async function bzpopmin<T>(
  this: T,
  keys: string[],
  timeout: number,
): Promise<[string, string, string] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (Array.isArray(reply) && reply.length === 3) {
        const [key, member, score] = reply;

        if (
          (typeof key === 'string' || key instanceof Buffer) &&
          (typeof member === 'string' || member instanceof Buffer) &&
          (typeof score === 'string' || score instanceof Buffer)
        ) {
          return [`${key}`, `${member}`, `${score}`];
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
