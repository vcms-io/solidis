import { executeCommand, tryReplyToScanDump } from './utils/index.ts';

export function createCommand(key: string, iterator: number) {
  return ['CF.SCANDUMP', key, `${iterator}`];
}

export async function cfScandump<T>(
  this: T,
  key: string,
  iterator: number,
): Promise<[nextIterator: number, data: Buffer | null]> {
  return await executeCommand(
    this,
    createCommand(key, iterator),
    (reply, command) => tryReplyToScanDump(reply, command, true),
  );
}
