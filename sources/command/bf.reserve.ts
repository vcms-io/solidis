import { executeCommand, tryReplyOK } from './utils/index.ts';

export function createCommand(
  key: string,
  errorRate: number,
  capacity: number,
  expansion?: number,
  nonScaling?: boolean,
) {
  const command = ['BF.RESERVE', key, `${errorRate}`, `${capacity}`];

  if (expansion !== undefined) {
    command.push('EXPANSION', `${expansion}`);
  }

  if (nonScaling) {
    command.push('NONSCALING');
  }

  return command;
}

export async function bfReserve<T>(
  this: T,
  ...parameters:
    | [
        key: string,
        errorRate: number,
        capacity: number,
        expansion?: number,
        nonScaling?: false,
      ]
    | [
        key: string,
        errorRate: number,
        capacity: number,
        expansion: undefined,
        nonScaling: boolean,
      ]
) {
  const [key, errorRate, capacity, expansion, nonScaling] = parameters;

  return await executeCommand(
    this,
    createCommand(key, errorRate, capacity, expansion, nonScaling),
    tryReplyOK,
  );
}
