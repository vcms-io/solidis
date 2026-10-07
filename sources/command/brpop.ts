import {
  executeCommand,
  formatBlockingTimeout,
  tryReplyToKeyValuePairOrNull,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(keys: string[], timeout: number) {
  return ['BRPOP', ...keys, formatBlockingTimeout(timeout)];
}

export async function brpop<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  keys: string[],
  timeout: number,
  options?: Options,
): Promise<[key: string, value: RespString<Options>] | null> {
  return await executeCommand(
    this,
    createCommand(keys, timeout),
    tryReplyToKeyValuePairOrNull,
    options,
    { blockingTimeout: timeout * 1000 },
  );
}
