import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(
  source: string,
  destination: string,
  timeout: number,
) {
  return ['BRPOPLPUSH', source, destination, `${timeout}`];
}

export async function brpoplpush<T>(
  this: T,
  source: string,
  destination: string,
  timeout: number,
): Promise<string | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, timeout),
    tryReplyToStringOrNull,
  );
}
