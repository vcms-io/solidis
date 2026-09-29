import {
  buildJsonKeyPathCommand,
  executeCommand,
  newUnexpectedReplyError,
  tryReplyToString,
  tryReplyToStringArray,
} from './utils/index.ts';

export function createCommand(key: string, path?: string) {
  return buildJsonKeyPathCommand('JSON.OBJKEYS', key, path);
}

export async function jsonObjkeys<T>(
  this: T,
  key: string,
): Promise<(string | null)[] | null>;
export async function jsonObjkeys<T>(
  this: T,
  key: string,
  path: string,
): Promise<(string | null)[] | ((string | null)[] | null)[] | null>;
export async function jsonObjkeys<T>(
  this: T,
  key: string,
  path?: string,
): Promise<(string | (string | null)[] | null)[] | null> {
  return await executeCommand(
    this,
    createCommand(key, path),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (!Array.isArray(reply)) {
        throw newUnexpectedReplyError(reply, command);
      }

      return reply.map((entry) => {
        if (entry === null) {
          return null;
        }

        if (Array.isArray(entry)) {
          return tryReplyToStringArray(entry, command, true);
        }

        return tryReplyToString(entry, command);
      });
    },
  );
}
