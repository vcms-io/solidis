import { formatInteger } from '../common/utils/internal.ts';
import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  capacity: number,
  bucketSize?: number,
  maxIterations?: number,
  expansion?: number,
) {
  const command = ['CF.RESERVE', key, formatInteger(capacity)];

  if (bucketSize !== undefined) {
    command.push('BUCKETSIZE', formatInteger(bucketSize));
  }

  if (maxIterations !== undefined) {
    command.push('MAXITERATIONS', formatInteger(maxIterations));
  }

  if (expansion !== undefined) {
    command.push('EXPANSION', formatInteger(expansion));
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
