import { RespDataTypes } from '../types/resp.ts';
import { executeCommand, tryReplyToString } from './utils/index.ts';

export function createCommand(key: string) {
  return ['TYPE', key];
}

export async function type<T>(
  this: T,
  key: string,
): Promise<RespDataTypes | 'NONE' | (string & {})> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    const type = tryReplyToString(reply, command);
    const name = type.toUpperCase();

    return name in RespDataTypes || name === 'NONE' ? name : type;
  });
}
