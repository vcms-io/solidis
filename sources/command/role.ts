import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToString,
  tryReplyTuple,
} from './utils/index.ts';

import type { RespRole } from '../index.ts';

export function createCommand() {
  return ['ROLE'];
}

export async function role<T>(this: T): Promise<RespRole> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    const name = tryReplyToString(tryReplyArray(reply, command)[0], command);

    if (name === 'master') {
      const [, replicationOffset, replicas] = tryReplyTuple(reply, 3, command);

      return {
        role: 'master',
        replicationOffset: tryReplyNumber(replicationOffset, command),
        slaves: tryReplyArray(replicas, command).map((replica) => {
          const [ip, port, offset] = tryReplyTuple(replica, 3, command);

          return {
            ip: String(ip),
            port: Number(port),
            offset: Number(offset),
          };
        }),
      };
    }

    if (name === 'slave') {
      const [, masterHost, masterPort, replicationState, replicationOffset] =
        tryReplyTuple(reply, 5, command);

      return {
        role: 'slave',
        masterHost: String(masterHost),
        masterPort: Number(masterPort),
        replicationState: String(replicationState),
        replicationOffset: Number(replicationOffset),
      };
    }

    throw newUnexpectedReplyError(reply, command);
  });
}
