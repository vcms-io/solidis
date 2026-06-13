import {
  executeCommand,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand() {
  return ['TIME'];
}

export async function time<T>(
  this: T,
): Promise<[seconds: number, microseconds: number]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply) && reply.length === 2) {
      const seconds = Number(`${reply[0]}`);
      const microseconds = Number(`${reply[1]}`);

      if (!Number.isNaN(seconds) && !Number.isNaN(microseconds)) {
        return [seconds, microseconds];
      }
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}
