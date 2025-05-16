import {
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
} from './utils/index.ts';

import type { RespWaitAOF } from '../index.ts';

export function createCommand(
  numlocal: number,
  numreplicas: number,
  timeout: number,
) {
  return ['WAITAOF', `${numlocal}`, `${numreplicas}`, `${timeout}`];
}

export async function waitaof<T>(
  this: T,
  numlocal: number,
  numreplicas: number,
  timeout: number,
): Promise<RespWaitAOF> {
  return await executeCommand(
    this,
    createCommand(numlocal, numreplicas, timeout),
    (reply, command) => {
      if (Array.isArray(reply) && reply.length === 2) {
        const [localFsynced, replicasAcknowledged] = reply;

        if (
          typeof localFsynced === 'number' &&
          typeof replicasAcknowledged === 'number'
        ) {
          return {
            localFsynced,
            replicasAcknowledged,
          };
        }
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
