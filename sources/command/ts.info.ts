import {
  executeCommand,
  newCommandError,
  processPairedArray,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

export function createCommand(key: string) {
  return ['TS.INFO', key];
}

export async function tsInfo<T>(
  this: T,
  key: string,
): Promise<Record<string, unknown>> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    if (!Array.isArray(reply)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    }

    const result: Record<string, unknown> = {};

    processPairedArray(
      reply,
      (key, value) => {
        result[key] = value;
      },
      command,
    );

    return result;
  });
}
