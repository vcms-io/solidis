import {
  executeCommand,
  tryReplyToMap,
  tryReplyToStringArray,
} from './utils/index.ts';

import type { RespClientTrackingInfo } from '../index.ts';

export function createCommand() {
  return ['CLIENT', 'TRACKINGINFO'];
}

export async function clientTrackinginfo<T>(
  this: T,
): Promise<RespClientTrackingInfo> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    const map = tryReplyToMap(reply, command);

    return {
      flags: tryReplyToStringArray(map.get('flags'), command),
      redirect: Number(map.get('redirect')),
      prefixes: tryReplyToStringArray(map.get('prefixes'), command),
    };
  });
}
