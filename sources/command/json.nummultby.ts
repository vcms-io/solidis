import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToJsonNumberText } from './utils/index.ts';

export function createCommand(key: string, path: string, value: number) {
  return ['JSON.NUMMULTBY', key, path, formatInteger(value)];
}

export async function jsonNummultby<T>(
  this: T,
  key: string,
  path: string,
  value: number,
): Promise<string> {
  return await executeCommand(
    this,
    createCommand(key, path, value),
    (reply, command) => tryReplyToJsonNumberText(reply, path, command),
  );
}
