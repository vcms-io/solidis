import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'TRACKINGINFO'];
}

export async function clientTrackinginfo<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}
