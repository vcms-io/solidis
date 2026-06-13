import { executeCommand, tryReplyToNumber } from './utils/index.ts';

export function createCommand(id: number) {
  return ['CLIENT', 'KILL', 'ID', `${id}`];
}

export async function clientKill<T>(this: T, id: number): Promise<number> {
  return await executeCommand(this, createCommand(id), tryReplyToNumber);
}
