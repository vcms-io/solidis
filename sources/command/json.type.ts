import { RespJsonType } from '../types/resp.ts';
import {
  buildJsonKeyPathCommand,
  executeCommand,
  newUnexpectedReplyError,
} from './utils/index.ts';

import type { StringOrBuffer } from '../index.ts';

export function createCommand(key: string, path?: string) {
  return buildJsonKeyPathCommand('JSON.TYPE', key, path);
}

function parseJsonType(
  item: unknown,
  command: string | StringOrBuffer[] | undefined,
): RespJsonType | null {
  if (item === null) {
    return null;
  }

  const value = item instanceof Buffer ? item.toString() : item;
  const matched = RespJsonType.find((t) => t === value);

  if (matched !== undefined) {
    return matched;
  }

  throw newUnexpectedReplyError(item, command);
}

export async function jsonType<T>(
  this: T,
  key: string,
): Promise<RespJsonType | null>;
export async function jsonType<T>(
  this: T,
  key: string,
  path: string,
): Promise<RespJsonType | (RespJsonType | null)[] | null>;
export async function jsonType<T>(
  this: T,
  key: string,
  path?: string,
): Promise<RespJsonType | (RespJsonType | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => {
      if (Array.isArray(reply)) {
        if (
          reply.length === 1 &&
          !Array.isArray(reply[0]) &&
          !path?.startsWith('$')
        ) {
          return parseJsonType(reply[0], command);
        }

        if (
          path !== undefined &&
          reply.length === 1 &&
          Array.isArray(reply[0])
        ) {
          return reply[0].map((item) => parseJsonType(item, command));
        }

        return reply.map((item) => parseJsonType(item, command));
      }

      return parseJsonType(reply, command);
    },
  );
}
