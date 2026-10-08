import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(numreplicas: number, timeout: number) {
  return ['WAIT', formatInteger(numreplicas), formatInteger(timeout)];
}

export async function wait<T>(
  this: T,
  numreplicas: number,
  timeout: number,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(numreplicas, timeout),
    tryReplyNumber,
    undefined,
    { blockingTimeout: timeout },
  );
}
