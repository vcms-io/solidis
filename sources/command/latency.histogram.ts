import {
  executeCommand,
  processPairedArray,
  tryReplyToMap,
  tryReplyToNumber,
} from './utils/index.ts';

import type { RespLatencyHistogram, StringOrBuffer } from '../index.ts';

export function createCommand(...events: string[]) {
  return ['LATENCY', 'HISTOGRAM', ...events];
}

function parseHistogram(
  data: unknown,
  command: StringOrBuffer[],
): Record<number, number> {
  const result: Record<number, number> = {};

  processPairedArray(
    data,
    (bucket, calls) => {
      result[tryReplyToNumber(bucket, command)] = tryReplyToNumber(
        calls,
        command,
      );
    },
    command,
  );

  return result;
}

export async function latencyHistogram<T>(
  this: T,
  ...events: [string, ...string[]]
): Promise<Record<string, RespLatencyHistogram>> {
  return await executeCommand(
    this,
    createCommand(...events),
    (reply, command) => {
      const result: Record<string, RespLatencyHistogram> = {};

      for (const [event, details] of tryReplyToMap(reply, command)) {
        const map = tryReplyToMap(details, command);

        result[String(event)] = {
          calls: tryReplyToNumber(map.get('calls'), command),
          histogramUsec: parseHistogram(map.get('histogram_usec'), command),
        };
      }

      return result;
    },
  );
}
