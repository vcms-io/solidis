import {
  executeCommand,
  processPairedArray,
  tryReplyToNumber,
} from './utils/index.ts';

import type { RespCuckooFilterInfo } from '../index.ts';

const infoKeyMap: Record<string, keyof RespCuckooFilterInfo> = {
  Size: 'size',
  'Number of buckets': 'numberOfBuckets',
  'Number of filter': 'numberOfFilter',
  'Number of items inserted': 'numberOfItemsInserted',
  'Number of items deleted': 'numberOfItemsDeleted',
  'Bucket size': 'bucketSize',
  'Expansion rate': 'expansionRate',
  'Max iteration': 'maxIteration',
};

export function createCommand(key: string) {
  return ['CF.INFO', key];
}

export async function cfInfo<T>(
  this: T,
  key: string,
): Promise<RespCuckooFilterInfo> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    const result: RespCuckooFilterInfo = {
      size: 0,
      numberOfBuckets: 0,
      numberOfFilter: 0,
      numberOfItemsInserted: 0,
      numberOfItemsDeleted: 0,
      bucketSize: 0,
      expansionRate: 0,
      maxIteration: 0,
    };

    processPairedArray(
      reply,
      (key, value) => {
        const resultKey = infoKeyMap[key];

        if (!resultKey) {
          return;
        }

        result[resultKey] = tryReplyToNumber(value, command);
      },
      'CF.INFO',
    );

    return result;
  });
}
