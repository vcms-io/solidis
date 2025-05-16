import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand() {
  return ['PUBSUB', 'NUMPAT'];
}

export async function pubsubNumpat<T>(this: T): Promise<number> {
  return await executeCommand(this, createCommand(), tryReplyNumber);
}
