import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(source: string, destination: string) {
  return ['RPOPLPUSH', source, destination];
}

export async function rpoplpush<T>(
  this: T,
  source: string,
  destination: string,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(source, destination),
    tryReplyToStringOrNull,
  );
}
