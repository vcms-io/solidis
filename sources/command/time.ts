import {
  executeCommand,
  tryReplyToInteger,
  tryReplyTuple,
} from './utils/index.ts';

export function createCommand() {
  return ['TIME'];
}

export async function time<T>(
  this: T,
): Promise<[seconds: number, microseconds: number]> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    const [seconds, microseconds] = tryReplyTuple(reply, 2, command);

    return [
      tryReplyToInteger(seconds, command),
      tryReplyToInteger(microseconds, command),
    ];
  });
}
