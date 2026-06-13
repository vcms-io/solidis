import { executeCommand, processPairedArray } from './utils/index.ts';

export function createCommand(key: string) {
  return ['TS.INFO', key];
}

export async function tsInfo<T>(
  this: T,
  key: string,
): Promise<Record<string, unknown>> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    const result: Record<string, unknown> = {};

    /**
     * RESP2 replies with a flat field/value array, RESP3 with a map;
     * processPairedArray accepts both and rejects anything else.
     */
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
