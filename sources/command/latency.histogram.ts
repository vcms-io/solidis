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

function parseHistogramData(histogramData: number[]): Record<number, number>;
function parseHistogramData(
  histogramData: Record<string, number>,
): Record<number, number>;
function parseHistogramData(
  histogramData: number[] | Record<string, number>,
): Record<number, number> {
  const result: Record<number, number> = {};

  if (Array.isArray(histogramData)) {
    for (let index = 0; index < histogramData.length; index += 2) {
      const latency = tryReplyToNumber(histogramData[index]);
      const count = tryReplyToNumber(histogramData[index + 1]);

      result[latency] = count;
    }

    return result;
  }

  for (const [key, value] of Object.entries(histogramData)) {
    result[tryReplyToNumber(key)] = value;
  }

  return result;
}

function isValidArrayLatencyHistogram(
  reply: unknown,
): reply is Array<
  string | [string | Buffer, number, string | Buffer, number[]]
> {
  if (!Array.isArray(reply) || reply.length < 2 || reply.length % 2 !== 0) {
    return false;
  }

  for (let index = 0; index < reply.length; index += 2) {
    const commandName = reply[index];
    const data = reply[index + 1];

    if (
      !(typeof commandName === 'string' || Buffer.isBuffer(commandName)) ||
      !Array.isArray(data) ||
      data.length !== 4
    ) {
      return false;
    }

    if (
      !(
        data[0] === 'calls' ||
        (Buffer.isBuffer(data[0]) && `${data[0]}` === 'calls')
      ) ||
      typeof data[1] !== 'number' ||
      !(
        data[2] === 'histogram_usec' ||
        (Buffer.isBuffer(data[2]) && `${data[2]}` === 'histogram_usec')
      ) ||
      !Array.isArray(data[3])
    ) {
      return false;
    }
  }

  return true;
}

function isValidMapLatencyHistogram(reply: unknown): reply is Record<
  string,
  {
    calls: number;
    histogram_usec: Record<string, number>;
  }
> {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
    return false;
  }

  return Object.entries(reply).every(
    ([_, data]) =>
      data &&
      typeof data === 'object' &&
      'calls' in data &&
      typeof data.calls === 'number' &&
      'histogram_usec' in data &&
      typeof data.histogram_usec === 'object',
  );
}

function parseArrayLatencyHistogram(
  reply: unknown,
  command: StringOrBuffer[],
): Record<string, RespLatencyHistogram> {
  const result: Record<string, RespLatencyHistogram> = {};

  if (!isValidArrayLatencyHistogram(reply)) {
    throw newCommandError(
      `${UnexpectedReplyPrefix}: ${JSON.stringify(reply)}`,
      command,
    );
  }

  for (let index = 0; index < reply.length; index += 2) {
    const commandName = Buffer.isBuffer(reply[index])
      ? `${reply[index]}`
      : reply[index];
    const data = reply[index + 1];

    if (!(typeof commandName === 'string') || !Array.isArray(data)) {
      throw newCommandError(
        `${InvalidReplyPrefix}: ${commandName} => ${data}`,
        command,
      );
    }

    const [, calls, , histogramData] = data;

    result[commandName] = {
      calls,
      histogramUsec: parseHistogramData(histogramData),
    };
  }

  return result;
}

function parseMapLatencyHistogram(
  reply: unknown,
  command: StringOrBuffer[],
): Record<string, RespLatencyHistogram> {
  const result: Record<string, RespLatencyHistogram> = {};

  if (!isValidMapLatencyHistogram(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
  }

  for (const [commandName, data] of Object.entries(reply)) {
    result[commandName] = {
      calls: data.calls,
      histogramUsec: parseHistogramData(data.histogram_usec),
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
