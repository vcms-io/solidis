import { executeCommand, tryReplyToMap } from './utils/index.ts';

import type { RespClientTrackingInfo } from '../index.ts';

export function createCommand() {
  return ['CLIENT', 'TRACKINGINFO'];
}

/** Normalises a flags/prefixes field that may be an array or a RESP3 Set. */
function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`);
  }

  if (value instanceof Set) {
    return [...value].map((item) => `${item}`);
  }

  return value === null || value === undefined ? [] : [`${value}`];
}

export async function clientTrackinginfo<T>(
  this: T,
): Promise<RespClientTrackingInfo> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    /** RESP2 replies with a flat field/value array, RESP3 with a map. */
    const map = tryReplyToMap(reply, command);

    return {
      flags: toStringList(map.get('flags')),
      redirect: Number(map.get('redirect')),
      prefixes: toStringList(map.get('prefixes')),
    };
  });
}
