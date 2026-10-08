import {
  executeCommand,
  processPairedArray,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyToString,
  tryReplyToStringOrNull,
  tryReplyToStringRecord,
} from './utils/index.ts';

import type {
  RespTimeSeriesInfo,
  RespTimeSeriesRule,
  StringOrBuffer,
} from '../index.ts';

export function createCommand(key: string) {
  return ['TS.INFO', key];
}

function tryReplyToRule(
  [key, bucketDuration, aggregator, alignment]: unknown[],
  command: StringOrBuffer[],
): RespTimeSeriesRule {
  return {
    key: tryReplyToString(key, command),
    bucketDuration: tryReplyToNumber(bucketDuration, command),
    aggregator: tryReplyToString(aggregator, command),
    alignment:
      alignment === undefined ? 0 : tryReplyToNumber(alignment, command),
  };
}

function tryReplyToRules(reply: unknown, command: StringOrBuffer[]) {
  if (reply instanceof Map) {
    return Array.from(reply, ([key, rule]) =>
      tryReplyToRule([key, ...tryReplyArray(rule, command)], command),
    );
  }

  return tryReplyArray(reply, command).map((rule) =>
    tryReplyToRule(tryReplyArray(rule, command), command),
  );
}

export async function tsInfo<T>(
  this: T,
  key: string,
): Promise<RespTimeSeriesInfo> {
  return await executeCommand(this, createCommand(key), (reply, command) => {
    const info: RespTimeSeriesInfo = {
      totalSamples: 0,
      memoryUsage: 0,
      firstTimestamp: 0,
      lastTimestamp: 0,
      retentionTime: 0,
      chunkCount: 0,
      chunkSize: 0,
      chunkType: '',
      duplicatePolicy: null,
      labels: {},
      sourceKey: null,
      rules: [],
      ignoreMaxTimeDiff: 0,
      ignoreMaxValDiff: 0,
    };

    processPairedArray(
      reply,
      (field, value) => {
        switch (field) {
          case 'totalSamples':
          case 'memoryUsage':
          case 'firstTimestamp':
          case 'lastTimestamp':
          case 'retentionTime':
          case 'chunkCount':
          case 'chunkSize':
          case 'ignoreMaxTimeDiff':
          case 'ignoreMaxValDiff':
            info[field] = tryReplyToNumber(value, command);
            break;
          case 'chunkType':
            info.chunkType = tryReplyToString(value, command);
            break;
          case 'duplicatePolicy':
          case 'sourceKey':
            info[field] = tryReplyToStringOrNull(value, command);
            break;
          case 'labels':
            info.labels = tryReplyToStringRecord(
              Array.isArray(value) ? value.flat() : value,
              command,
            );
            break;
          case 'rules':
            info.rules = tryReplyToRules(value, command);
            break;
        }
      },
      command,
    );

    return info;
  });
}
