import {
  executeCommand,
  formatBlockingTimeout,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(
  source: string,
  destination: string,
  timeout: number,
) {
  return ['BRPOPLPUSH', source, destination, formatBlockingTimeout(timeout)];
}

export async function brpoplpush<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  source: string,
  destination: string,
  timeout: number,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(source, destination, timeout),
    tryReplyToStringOrBufferOrNull,
    options,
    { blockingTimeout: timeout * 1000 },
  );
}
