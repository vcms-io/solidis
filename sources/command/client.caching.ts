import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { RespYesOrNo } from '../index.ts';

export function createCommand(mode: RespYesOrNo) {
  return ['CLIENT', 'CACHING', mode];
}

export async function clientCaching<T>(this: T, mode: RespYesOrNo) {
  return await executeCommand(this, createCommand(mode), tryReplyOK);
}
