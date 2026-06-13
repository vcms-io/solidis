import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  tryReplyToNumber,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type { RespLatencyHistogram, StringOrBuffer } from '../index.ts';

export function createCommand(...events: string[]) {
  return ['LATENCY', 'HISTOGRAM', ...events];
}

function parseHistogramData(
  data: unknown,
  command: StringOrBuffer[],
): Record<number, number> {
  const result: Record<number, number> = {};

  if (data instanceof Map) {
    for (const [key, value] of data) {
      result[tryReplyToNumber(key, command)] = tryReplyToNumber(value, command);
    }

    return result;
  }

  if (!Array.isArray(data)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${data}`, command);
  }

  for (let index = 0; index < data.length; index += 2) {
    result[tryReplyToNumber(data[index], command)] = tryReplyToNumber(
      data[index + 1],
      command,
    );
  }

  return result;
}

function parseArrayLatencyHistogram(
  reply: unknown[],
  command: StringOrBuffer[],
): Record<string, RespLatencyHistogram> {
  const result: Record<string, RespLatencyHistogram> = {};

  for (let index = 0; index < reply.length; index += 2) {
    const data = reply[index + 1];

    if (!Array.isArray(data) || data.length !== 4) {
      throw newCommandError(`${InvalidReplyPrefix}: ${data}`, command);
    }

    result[String(reply[index])] = {
      calls: tryReplyToNumber(data[1], command),
      histogramUsec: parseHistogramData(data[3], command),
    };
  }

  return result;
}

function parseMapLatencyHistogram(
  reply: Map<unknown, unknown>,
  command: StringOrBuffer[],
): Record<string, RespLatencyHistogram> {
  const result: Record<string, RespLatencyHistogram> = {};

  for (const [key, value] of reply) {
    if (!(value instanceof Map)) {
      throw newCommandError(`${InvalidReplyPrefix}: ${value}`, command);
    }

    result[String(key)] = {
      calls: tryReplyToNumber(value.get('calls'), command),
      histogramUsec: parseHistogramData(value.get('histogram_usec'), command),
    };
  }

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
      if (Array.isArray(reply)) {
        return parseArrayLatencyHistogram(reply, command);
      }

      if (reply instanceof Map) {
        return parseMapLatencyHistogram(reply, command);
      }

      throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
    },
  );
}
