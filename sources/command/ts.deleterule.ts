import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(sourceKey: string, destinationKey: string) {
  return ['TS.DELETERULE', sourceKey, destinationKey];
}

export async function tsDeleterule<T>(
  this: T,
  sourceKey: string,
  destinationKey: string,
) {
  return await executeCommand(
    this,
    createCommand(sourceKey, destinationKey),
    tryReplyOK,
  );
}
