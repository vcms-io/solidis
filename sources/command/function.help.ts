import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

export function createCommand() {
  return ['FUNCTION', 'HELP'];
}

export async function functionHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((item) => {
        if (typeof item === 'string' || item instanceof Buffer) {
          return `${item}`;
        }

        throw newCommandError(`${InvalidReplyPrefix}: ${item}`, command);
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}
