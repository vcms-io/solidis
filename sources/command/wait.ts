import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(numreplicas: number, timeout: number) {
  return ['WAIT', `${numreplicas}`, `${timeout}`];
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
  );
}
