import {
  executeCommand,
  tryReplyToNullableStringArray,
} from './utils/index.ts';

export function createCommand(key: string, members: string[]) {
  return ['GEOHASH', key, ...members];
}

export async function geohash<T>(
  this: T,
  key: string,
  members: string[],
): Promise<Array<string | null>> {
  return await executeCommand(
    this,
    createCommand(key, members),
    tryReplyToNullableStringArray,
  );
}
