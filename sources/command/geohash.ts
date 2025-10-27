import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(key: string, members: string[]) {
  return ['GEOHASH', key, ...members];
}

export async function geohash<T>(
  this: T,
  key: string,
  members: string[],
): Promise<Array<string | null>> {
  return await executeCommand(
    this,
    createCommand(key, members),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((hash) => {
        if (hash === null) {
          return null;
        }

        if (typeof hash === 'string' || hash instanceof Buffer) {
          return `${hash}`;
        }

        throw newCommandError(`${InvalidReplyPrefix}: ${hash}`, command);
      });
    },
  );
}
