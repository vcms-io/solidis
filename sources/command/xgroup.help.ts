import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand() {
  return ['XGROUP', 'HELP'];
}

export async function xgroupHelp<T>(this: T): Promise<string[]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply)) {
      return reply.map((line) => {
        if (typeof line === 'string' || line instanceof Buffer) {
          return `${line}`;
        }

        throw newCommandError(`${InvalidReplyPrefix}: ${line}`, command);
      });
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}
