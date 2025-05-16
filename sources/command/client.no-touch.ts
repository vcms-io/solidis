import { executeCommand, tryReplyOK } from './utils/index.ts';

import type { RespOnOrOff } from '../index.ts';

export function createCommand(mode: RespOnOrOff) {
  return ['CLIENT', 'NO-TOUCH', mode];
}

export async function clientNoTouch<T>(this: T, mode: RespOnOrOff) {
  return await executeCommand(this, createCommand(mode), tryReplyOK);
}
