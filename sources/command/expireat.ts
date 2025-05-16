import { executeCommand, tryReplyNumber } from './utils/index.ts';

export function createCommand(
  key: string,
  timestamp: number,
  options?: { notExists?: boolean },
) {
  const command = ['EXPIREAT', key, `${timestamp}`];

  if (options?.notExists) {
    command.push('NX');
  }

  return command;
}

export async function expireat<T>(
  this: T,
  key: string,
  timestamp: number,
  options?: { notExists?: boolean },
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, timestamp, options),
    tryReplyNumber,
  );
}
