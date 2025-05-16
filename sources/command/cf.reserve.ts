import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  capacity: number,
  bucketSize?: number,
  maxIterations?: number,
  expansion?: number,
) {
  const command = ['CF.RESERVE', key, `${capacity}`];

  if (bucketSize !== undefined) {
    command.push('BUCKETSIZE', `${bucketSize}`);
  }

  if (maxIterations !== undefined) {
    command.push('MAXITERATIONS', `${maxIterations}`);
  }

  if (expansion !== undefined) {
    command.push('EXPANSION', `${expansion}`);
  }

  return command;
}

export async function cfReserve<T>(
  this: T,
  key: string,
  capacity: number,
  bucketSize?: number,
  maxIterations?: number,
  expansion?: number,
) {
  return await executeCommand(
    this,
    createCommand(key, capacity, bucketSize, maxIterations, expansion),
    tryReplyOK,
  );
}
