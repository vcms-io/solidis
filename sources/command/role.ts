import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespRole } from '../index.ts';

export function createCommand() {
  return ['ROLE'];
}

export async function role<T>(this: T): Promise<RespRole> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    if (Array.isArray(reply) && reply.length >= 1) {
      const [role] = reply;

      if (role === 'master' && reply.length === 3) {
        const [, replicationOffset, slaves] = reply;

        if (typeof replicationOffset !== 'number' || !Array.isArray(slaves)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, command);
        }

        return {
          role: 'master',
          replicationOffset,
          slaves: slaves.map((slave) => {
            if (!Array.isArray(slave) || slave.length !== 3) {
              throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, command);
            }
            const [ip, port, offset] = slave;
            return {
              ip: String(ip),
              port: Number(port),
              offset: Number(offset),
            };
          }),
        };
      }

      if (role === 'slave' && reply.length === 5) {
        const [, masterHost, masterPort, replicationState, replicationOffset] =
          reply;

        return {
          role: 'slave',
          masterHost: String(masterHost),
          masterPort: Number(masterPort),
          replicationState: String(replicationState),
          replicationOffset: Number(replicationOffset),
        };
      }
    }

    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  });
}
