import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(channel: string, message: string) {
  return ['SPUBLISH', channel, message];
}

export async function spublish<T>(
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
