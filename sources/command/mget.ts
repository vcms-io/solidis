import {
  executeCommand,
  newCommandError,
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
  ...parameters:
    | string[]
    | [...keys: string[], options: CommandBufferOptions | undefined]
): Promise<(StringOrBuffer | null)[]>;
export async function mget<T>(
  this: T,
  ...parameters: (string | CommandBufferOptions | undefined)[]
): Promise<(StringOrBuffer | null)[]> {
  const options = parameters.at(-1);
  const keys =
    typeof options === 'string' ? parameters : parameters.slice(0, -1);

  if (!keys.every((key) => typeof key === 'string')) {
    throw newCommandError('Keys must be strings', 'MGET');
  }

  return await executeCommand(this, createCommand(...keys), (reply, command) =>
    tryReplyToNullableStringOrBufferArray(
      reply,
      command,
      typeof options === 'string' ? undefined : options,
    ),
  );
}
