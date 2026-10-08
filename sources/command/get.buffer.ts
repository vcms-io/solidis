import {
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

export function createCommand(key: string) {
  return ['GET', key];
}

export async function getBuffer<T>(
  this: T,
  key: string,
): Promise<Buffer | null> {
  return await executeCommand(this, createCommand(key), (reply, command) =>
    tryReplyToStringOrBufferOrNull(reply, command, { buffer: true }),
  );
}
