import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { RespClientReplyMode } from '../index.ts';

export function createCommand(mode: RespClientReplyMode) {
  return ['CLIENT', 'REPLY', mode];
}

export async function clientReply<T>(this: T, mode: RespClientReplyMode) {
  return await executeCommand(this, createCommand(mode), tryReplyOK);
}
