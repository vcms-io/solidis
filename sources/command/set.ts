import {
  buildSetCommand,
  executeCommand,
  tryReplyOK,
  tryReplyToStringOrBuffer,
} from './utils/index.ts';

import type { CommandSetOptions, RespOK, StringOrBuffer } from '../index.ts';

export const createCommand = buildSetCommand;

export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions & { returnOldValue?: false },
): Promise<RespOK | null>;
export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options: CommandSetOptions & {
    returnOldValue: true;
    returnOldValueAsBuffer?: false;
  },
): Promise<string | null>;
export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options: CommandSetOptions & {
    returnOldValue: true;
    returnOldValueAsBuffer: true;
  },
): Promise<Buffer | null>;
export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
): Promise<StringOrBuffer | RespOK | null>;
export async function set<T>(
  this: T,
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
): Promise<StringOrBuffer | RespOK | null> {
  const returnOldValue = options?.returnOldValue === true;
  const buffer = options?.returnOldValueAsBuffer;

  return await executeCommand(
    this,
    createCommand(key, value, options),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (returnOldValue) {
        return tryReplyToStringOrBuffer(reply, command, { buffer });
      }

      return tryReplyOK(reply, command);
    },
  );
}
