import { executeCommand, tryReplyToStringOrNull } from './utils/index.ts';

export function createCommand(key: string) {
  return ['OBJECT', 'ENCODING', key];
}

export async function objectEncoding<T>(
  this: T,
  key: string,
): Promise<string | null> {
  return await executeCommand(this, createCommand(key), tryReplyToStringOrNull);
}
