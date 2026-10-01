import {
  executeCommand,
  tryReplyToNullableStringOrBufferArray,
} from './utils/index.ts';

import type {
  CommandBufferOptions,
  RespString,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(...keys: string[]) {
  return ['MGET', ...keys];
}

export async function mget<T>(
  this: T,
  ...keys: string[]
): Promise<(string | null)[]>;
export async function mget<T, Options extends CommandBufferOptions>(
  this: T,
  ...parameters: [...keys: string[], options: Options]
): Promise<(RespString<Options> | null)[]>;
export async function mget<T>(
  this: T,
  ...parameters: (string | CommandBufferOptions)[]
): Promise<(StringOrBuffer | null)[]> {
  const keys = parameters.filter((parameter) => typeof parameter === 'string');
  const options = parameters.find((parameter) => typeof parameter !== 'string');

  return await executeCommand(this, createCommand(...keys), (reply, command) =>
    tryReplyToNullableStringOrBufferArray(reply, command, options),
  );
}
