import {
  executeCommand,
  tryReplyNumber,
  tryReplyTuple,
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
      const [localFsynced, replicasAcknowledged] = tryReplyTuple(
        reply,
        2,
        command,
      );

      return {
        localFsynced: tryReplyNumber(localFsynced, command),
        replicasAcknowledged: tryReplyNumber(replicasAcknowledged, command),
      };
    },
    undefined,
    { blockingTimeout: timeout },
  );
}
