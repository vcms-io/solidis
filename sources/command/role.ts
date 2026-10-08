import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyArray,
  tryReplyNumber,
  tryReplyToInteger,
  tryReplyToString,
  tryReplyToStringArray,
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
            port: tryReplyToInteger(port, command),
            offset: tryReplyToInteger(offset, command),
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
        masterPort: tryReplyNumber(masterPort, command),
        replicationState: String(replicationState),
        replicationOffset: tryReplyNumber(replicationOffset, command),
      };
    }

    if (name === 'sentinel') {
      const [, masterNames] = tryReplyTuple(reply, 2, command);

      return {
        role: 'sentinel',
        masterNames: tryReplyToStringArray(masterNames, command),
      };
    }

    throw newUnexpectedReplyError(reply, command);
  });
}
