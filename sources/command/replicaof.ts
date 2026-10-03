import { RespOK } from '../types/resp.ts';
import {
  executeCommand,
  newUnexpectedReplyError,
  tryReplyToString,
} from './utils/index.ts';

export function createCommand(host: string, port: number | 'ONE') {
  return ['REPLICAOF', host, `${port}`];
}

export async function replicaof<T>(
  this: T,
  host: string,
  port: number | 'ONE',
): Promise<RespOK> {
  return await executeCommand(
    this,
    createCommand(host, port),
    (reply, command) => {
      if (tryReplyToString(reply, command).startsWith(RespOK)) {
        return RespOK;
      }

      throw newUnexpectedReplyError(reply, command);
    },
  );
}
