import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

export function createCommand() {
  return ['TIME'];
}

export async function time<T>(
  this: T,
): Promise<[seconds: number, microseconds: number]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply) && reply.length === 2) {
      const [seconds, microseconds] = reply;

      if (typeof seconds === 'number' && typeof microseconds === 'number') {
        return [seconds, microseconds];
      }
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}
