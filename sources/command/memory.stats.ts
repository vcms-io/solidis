import {
  executeCommand,
  processPairedArray,
  tryReplyToMap,
  tryReplyToNumber,
} from './utils/index.ts';

import type { RespMemoryStats } from '../index.ts';

export function createCommand() {
  return ['MEMORY', 'STATS'];
}

export async function memoryStats<T>(this: T): Promise<RespMemoryStats> {
  return await executeCommand(this, createCommand(), (reply, command) => {
    const result = new Map<string, unknown>();
    const dbEntries: RespMemoryStats['db'] = {};

    processPairedArray(
      reply,
      (key, value) => {
        if (/^db\.\d+$/.test(key)) {
          const database = tryReplyToMap(value, command);

          dbEntries[key.slice(3)] = {
            overhead: {
              hashtable: {
                main: tryReplyToNumber(
                  database.get('overhead.hashtable.main'),
                  command,
                ),
                expires: tryReplyToNumber(
                  database.get('overhead.hashtable.expires'),
                  command,
                ),
              },
            },
          };

          return;
        }

        result.set(key, value);
      },
      command,
    );

    const toNumber = (key: string) =>
      tryReplyToNumber(result.get(key) ?? 0, command);

    return {
      peak: {
        allocated: toNumber('peak.allocated'),
        percentage: toNumber('peak.percentage'),
      },
      total: {
        allocated: toNumber('total.allocated'),
      },
      startup: {
        allocated: toNumber('startup.allocated'),
      },
      replication: {
        backlog: toNumber('replication.backlog'),
      },
      clients: {
        slaves: toNumber('clients.slaves'),
        normal: toNumber('clients.normal'),
      },
      cluster: {
        links: toNumber('cluster.links'),
      },
      aof: {
        buffer: toNumber('aof.buffer'),
      },
      functions: {
        caches: toNumber('functions.caches'),
      },
      db: dbEntries,
      overhead: {
        total: toNumber('overhead.total'),
        db: {
          hashtable: {
            lut: toNumber('overhead.db.hashtable.lut'),
            rehashing: toNumber('overhead.db.hashtable.rehashing'),
          },
        },
      },
      dbDict: {
        rehashingCount: toNumber('db.dict.rehashing.count'),
      },
      keys: {
        count: toNumber('keys.count'),
        bytesPerKey: toNumber('keys.bytes-per-key'),
      },
      dataset: {
        bytes: toNumber('dataset.bytes'),
        percentage: toNumber('dataset.percentage'),
      },
      allocator: {
        allocated: toNumber('allocator.allocated'),
        active: toNumber('allocator.active'),
        resident: toNumber('allocator.resident'),
        fragmentation: {
          ratio: toNumber('allocator-fragmentation.ratio'),
          bytes: toNumber('allocator-fragmentation.bytes'),
        },
        rss: {
          ratio: toNumber('allocator-rss.ratio'),
          bytes: toNumber('allocator-rss.bytes'),
        },
      },
      rssOverhead: {
        ratio: toNumber('rss-overhead.ratio'),
        bytes: toNumber('rss-overhead.bytes'),
      },
      fragmentation: toNumber('fragmentation'),
      fragmentationBytes: toNumber('fragmentation.bytes'),
    };
  });
}
