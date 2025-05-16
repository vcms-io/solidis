import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand() {
  return ['LATENCY', 'DOCTOR'];
}

export async function latencyDoctor<T>(this: T): Promise<string> {
  return await executeCommand(this, createCommand(), tryReplyToString);
}
