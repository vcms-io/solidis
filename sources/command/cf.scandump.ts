import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

export function createCommand(key: string, iterator: number) {
  return ['CF.SCANDUMP', key, `${iterator}`];
}

export async function cfScandump<T>(
  this: T,
  key: string,
  iterator: number,
): Promise<[nextIterator: number, data: Buffer | null]> {
  return await executeCommand(
    this,
    createCommand(key, iterator),
    (reply, command) => {
      if (Array.isArray(reply) && reply.length === 2) {
        const [nextIterator, data] = reply;

        if (data === null) {
          return [Number(nextIterator), null];
        }

        if (!(data instanceof Buffer)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${data}`, command);
        }

        return [Number(nextIterator), data];
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
