import {
  executeCommand,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespMemoryUsage } from '../index.ts';

export function createCommand(key: string, samples?: number) {
  const command = ['MEMORY', 'USAGE', key];

  if (samples !== undefined) {
    command.push('SAMPLES', `${samples}`);
  }

  return command;
}

export async function memoryUsage<T>(
  this: T,
  key: string,
  samples?: number,
): Promise<RespMemoryUsage | null> {
  return await executeCommand(
    this,
    createCommand(key, samples),
    (reply, command) => {
      if (reply === null) {
        return null;
      }

      if (Array.isArray(reply) && reply.length === 2) {
        const [bytes, peak] = reply;
        if (typeof bytes === 'number' && typeof peak === 'number') {
          return { bytes, peak };
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
