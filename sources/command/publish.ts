import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(channel: string, message: string) {
  return ['PUBLISH', channel, message];
}

export async function publish<T>(
  this: T,
  channel: string,
  message: string,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(channel, message),
    tryReplyNumber,
  );
}
