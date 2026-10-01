import {
  executeCommand,
  tryReplyToStringOrBufferArray,
} from './utils/index.ts';

import type { CommandBufferOptions, RespString } from '../index.ts';

export function createCommand(key: string) {
  return ['HVALS', key];
}

export async function hvals<
  T,
  Options extends CommandBufferOptions | undefined = undefined,
>(this: T, key: string, options?: Options): Promise<RespString<Options>[]> {
  return await executeCommand(this, createCommand(key), (reply, command) =>
    tryReplyToStringOrBufferArray(reply, command, options),
  );
}
