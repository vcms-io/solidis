import {
  executeCommand,
  tryReplyToStringOrBufferOrNull,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(source: string, destination: string) {
  return ['RPOPLPUSH', source, destination];
}

export async function rpoplpush<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(
  this: T,
  source: string,
  destination: string,
  options?: Options,
): Promise<RespString<Options> | null> {
  return await executeCommand(
    this,
    createCommand(source, destination),
    (reply, command) => tryReplyToStringOrBufferOrNull(reply, command, options),
  );
}
