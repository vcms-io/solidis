import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(key: string, members: string[]) {
  return ['ZMSCORE', key, ...members];
}

export async function zmscore<T>(
  this: T,
  key: string,
  members: string[],
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, members),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((score) => {
        if (score === null) {
          return null;
        }

        if (!(typeof score === 'string' || score instanceof Buffer)) {
          throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
        }

        const scoreNumber = Number(`${score}`);

        if (Number.isNaN(scoreNumber)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, command);
        }

        return scoreNumber;
      });
    },
  );
}
