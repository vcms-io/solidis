import { appendItems } from '../common/utils/internal.ts';
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

export function createCommand(key: string, ...fields: string[]) {
  return ['HMGET', key, ...fields];
}

export async function hmget<T>(
  this: T,
  key: string,
  ...fields: string[]
): Promise<(string | null)[]>;
export async function hmget<T, Options extends CommandBufferOptions>(
  this: T,
  key: string,
  ...parameters: [...fields: string[], options: Options]
): Promise<(RespString<Options> | null)[]>;
export async function hmget<T>(
  this: T,
  key: string,
  ...parameters:
    | string[]
    | [...fields: string[], options: CommandBufferOptions | undefined]
): Promise<(StringOrBuffer | null)[]>;
export async function hmget<T>(
  this: T,
  key: string,
  ...parameters: (string | CommandBufferOptions | undefined)[]
): Promise<(StringOrBuffer | null)[]> {
  const last = parameters.at(-1);
  const options =
    typeof last === 'object' && last !== null && !Buffer.isBuffer(last)
      ? last
      : undefined;
  const fields =
    last === undefined || options ? parameters.slice(0, -1) : parameters;

  if (!fields.every((field) => typeof field === 'string')) {
    throw newCommandError('Fields must be strings', 'HMGET');
  }

  return await executeCommand(
    this,
    appendItems(createCommand(key), fields),
    tryReplyToNullableStringOrBufferArray,
    options,
  );
}
