import {
  executeCommand,
  tryReplyToNullableNumberArray,
} from './utils/index.ts';

export function createCommand(key: string, members: string[]) {
  return ['ZMSCORE', key, ...members];
}

export async function zmscore<T>(
  this: T,
  key: string,
  members: string[],
): Promise<(number | null)[]> {
  return await executeCommand(
    this,
    createCommand(key, members),
    tryReplyToNullableNumberArray,
  );
}
