import { executeCommand, tryReplyToNumberArray } from './utils/index.ts';

export function createCommand(key: string, fields: string[]) {
  return ['HPERSIST', key, 'FIELDS', `${fields.length}`, ...fields];
}

export async function hpersist<T>(
  this: T,
  key: string,
  fields: string[],
): Promise<number[]> {
  return await executeCommand(
    this,
    createCommand(key, fields),
    tryReplyToNumberArray,
  );
}
