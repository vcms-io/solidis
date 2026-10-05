import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyToNumber } from './utils/index.ts';

export function createCommand(id: number) {
  return ['CLIENT', 'KILL', 'ID', formatInteger(id)];
}

export async function clientKill<T>(this: T, id: number): Promise<number> {
  return await executeCommand(this, createCommand(id), tryReplyToNumber);
}
