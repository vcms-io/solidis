import {
  executeCommand,
  tryReplyNumber,
  tryReplyToMap,
} from './utils/index.ts';

import type { RespBloomFilterInfo } from '../index.ts';

const infoKeyMap: Record<string, keyof RespBloomFilterInfo> = {
  Capacity: 'capacity',
  Size: 'size',
  'Number of filters': 'numberOfFilters',
  'Number of items inserted': 'numberOfItemsInserted',
  'Expansion rate': 'expansionRate',
};

export function createCommand(key: string) {
  return ['BF.INFO', key];
}

export async function bfInfo<T>(
  this: T,
  key: string,
): Promise<RespBloomFilterInfo> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    const result: RespBloomFilterInfo = {
      capacity: 0,
      size: 0,
      numberOfFilters: 0,
      numberOfItemsInserted: 0,
      expansionRate: 0,
    };

    const map = tryReplyToMap(reply, command);

    for (const [key, value] of map) {
      const resultKey = infoKeyMap[String(key)];

      if (!resultKey || !value) {
        continue;
      }

      result[resultKey] = tryReplyNumber(value, command);
    }

    return result;
  });
}
