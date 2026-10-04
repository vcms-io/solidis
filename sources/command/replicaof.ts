import { RespOK } from '../types/resp.ts';
import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyToString,
} from './utils/index.ts';

import type { CommandReplicaofTarget } from '../index.ts';

export function createCommand(...[host, port]: CommandReplicaofTarget) {
  return ['REPLICAOF', host, `${port}`];
}

export async function replicaof<T>(
  this: T,
  ...target: CommandReplicaofTarget
): Promise<RespOK> {
  return await executeCommand(
    this,
    createCommand(...target),
    (reply, command) => {
      if (tryReplyToString(reply, command).startsWith(RespOK)) {
        return RespOK;
      }

      throw newUnexpectedReplyError(reply, command);
    },
  );
}
