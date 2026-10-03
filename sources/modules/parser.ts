import { SolidisBulkZeroCopyThreshold } from '../common/constants.ts';
import {
  SolidisArrayReplyByte,
  SolidisAttributeReplyByte,
  SolidisBigNumberReplyByte,
  SolidisBlobErrorReplyByte,
  SolidisBooleanReplyByte,
  SolidisBulkReplyByte,
  SolidisCarriageReturnByte,
  SolidisColonByte,
  SolidisDoubleReplyByte,
  SolidisErrorReplyByte,
  SolidisIntegerReplyByte,
  SolidisLineFeedByte,
  SolidisLowercaseFByte,
  SolidisLowercaseTByte,
  SolidisMapReplyByte,
  SolidisMinusByte,
  SolidisNullReplyByte,
  SolidisPushReplyByte,
  SolidisSetReplyByte,
  SolidisStringReplyByte,
  SolidisVerbatimStringReplyByte,
  SolidisZeroByte,
} from '../common/internal.ts';
import { RespError, SolidisParserError } from '../common/utils/error.ts';
import { parseDouble } from '../common/utils/number.ts';
import { RespPush } from '../types/resp.ts';

import type { SolidisData, SolidisParserOptions } from '../types/solidis.ts';

const NeedsMoreData = Symbol();
const NoValue = Symbol();

const EmptyBuffer = Buffer.alloc(0);

type SolidisParserStep = SolidisData | typeof NeedsMoreData | typeof NoValue;

interface SolidisParserFrame {
  type: number;
  items: SolidisData[];
  remaining: number;
}

function createItems(type: number): SolidisData[] {
  return type === SolidisPushReplyByte ? new RespPush() : [];
}

function createMap(items: SolidisData[]) {
  const map = new Map<string, SolidisData>();

  for (let index = 0; index < items.length; index += 2) {
    const key = items[index];

    if (key !== null) {
      map.set(String(key), items[index + 1]);
    }
  }

  return map;
}

function createAggregate(type: number, items: SolidisData[]): SolidisData {
  if (type === SolidisMapReplyByte) {
    return createMap(items);
  }

  if (type === SolidisSetReplyByte) {
    return new Set(items);
  }

  return items;
}

export class SolidisParser {
  readonly #maxBulkStringLength: number;

  #buffer: Buffer = EmptyBuffer;
  #offset = 0;
  #pendingChunks: Buffer[] = [];
  #pendingLength = 0;
  #requiredLength = 0;
  #frames: SolidisParserFrame[] = [];

  constructor(options: SolidisParserOptions) {
    this.#maxBulkStringLength = options.parser.maxBulkStringLength;
  }

  public parse(chunk: Buffer): SolidisData[] {
    const replies: SolidisData[] = [];

    if (!this.#append(chunk)) {
      return replies;
    }

    while (this.#offset < this.#buffer.length) {
      const step = this.#readStep();

      if (step === NeedsMoreData) {
        break;
      }

      if (step !== NoValue) {
        this.#collect(step, replies);
      }
    }

    if (this.#offset === this.#buffer.length) {
      this.#buffer = EmptyBuffer;
      this.#offset = 0;
    }

    return replies;
  }

  #append(chunk: Buffer) {
    if (this.#offset === this.#buffer.length) {
      this.#buffer = chunk;
      this.#offset = 0;

      return true;
    }

    this.#pendingChunks.push(chunk);
    this.#pendingLength += chunk.length;

    const availableLength =
      this.#buffer.length - this.#offset + this.#pendingLength;

    if (this.#requiredLength < 0 && !chunk.includes(SolidisLineFeedByte)) {
      if (availableLength > this.#maxBulkStringLength) {
        throw new SolidisParserError(
          `Line length exceeds maximum allowed ${this.#maxBulkStringLength}`,
        );
      }

      return false;
    }

    if (availableLength < this.#requiredLength) {
      return false;
    }

    this.#buffer = Buffer.concat([
      this.#buffer.subarray(this.#offset),
      ...this.#pendingChunks,
    ]);
    this.#offset = 0;
    this.#pendingChunks = [];
    this.#pendingLength = 0;
    this.#requiredLength = 0;

    return true;
  }

  #collect(value: SolidisData, replies: SolidisData[]) {
    let completed = value;

    while (true) {
      const frame = this.#frames.at(-1);

      if (!frame) {
        replies.push(completed);

        return;
      }

      frame.items.push(completed);
      frame.remaining -= 1;

      if (frame.remaining > 0) {
        return;
      }

      this.#frames.pop();

      if (frame.type === SolidisAttributeReplyByte) {
        return;
      }

      completed = createAggregate(frame.type, frame.items);
    }
  }

  #readStep(): SolidisParserStep {
    const type = this.#buffer[this.#offset];

    switch (type) {
      case SolidisBulkReplyByte:
      case SolidisVerbatimStringReplyByte:
      case SolidisBlobErrorReplyByte: {
        return this.#readBlob(type);
      }

      case SolidisArrayReplyByte:
      case SolidisSetReplyByte:
      case SolidisPushReplyByte:
      case SolidisMapReplyByte:
      case SolidisAttributeReplyByte: {
        return this.#readAggregate(type);
      }

      case SolidisStringReplyByte:
      case SolidisErrorReplyByte:
      case SolidisIntegerReplyByte:
      case SolidisNullReplyByte:
      case SolidisBooleanReplyByte:
      case SolidisDoubleReplyByte:
      case SolidisBigNumberReplyByte: {
        return this.#readSimple(type);
      }

      default: {
        throw new SolidisParserError(
          `Unknown prefix '${String.fromCharCode(type)}'`,
        );
      }
    }
  }

  #readSimple(type: number): SolidisParserStep {
    const start = this.#offset + 1;
    const end = this.#findLineEnd(start);

    if (end === -1) {
      return NeedsMoreData;
    }

    this.#offset = end + 2;

    switch (type) {
      case SolidisStringReplyByte: {
        return this.#buffer.toString('utf8', start, end);
      }

      case SolidisErrorReplyByte: {
        return new RespError(this.#buffer.toString('utf8', start, end));
      }

      case SolidisIntegerReplyByte: {
        return (
          this.#parseInteger(start, end) ??
          new RespError(`Integer: '${this.#readText(start, end)}'`)
        );
      }

      case SolidisNullReplyByte: {
        if (end !== start) {
          throw new SolidisParserError('Null: unexpected payload');
        }

        return null;
      }

      case SolidisBooleanReplyByte: {
        return this.#readBoolean(start, end);
      }

      case SolidisDoubleReplyByte: {
        const text = this.#readText(start, end);

        return parseDouble(text) ?? new RespError(`Double: '${text}'`);
      }

      default: {
        return this.#readBigNumber(this.#readText(start, end));
      }
    }
  }

  #readBlob(type: number): SolidisParserStep {
    const buffer = this.#buffer;
    const start = this.#offset;
    const lineEnd = this.#findLineEnd(start + 1);

    if (lineEnd === -1) {
      return NeedsMoreData;
    }

    const length = this.#readLength(start + 1, lineEnd);

    if (length < 0) {
      this.#offset = lineEnd + 2;

      return null;
    }

    if (length > this.#maxBulkStringLength) {
      throw new SolidisParserError(
        `Bulk length ${length} exceeds maximum allowed ${this.#maxBulkStringLength}`,
      );
    }

    const dataStart = lineEnd + 2;
    const dataEnd = dataStart + length;

    if (dataEnd + 2 > buffer.length) {
      this.#requiredLength = dataEnd + 2 - start;

      return NeedsMoreData;
    }

    if (
      buffer[dataEnd] !== SolidisCarriageReturnByte ||
      buffer[dataEnd + 1] !== SolidisLineFeedByte
    ) {
      throw new SolidisParserError('Bulk: missing CRLF');
    }

    this.#offset = dataEnd + 2;

    if (type === SolidisBlobErrorReplyByte) {
      return new RespError(buffer.toString('utf8', dataStart, dataEnd));
    }

    if (type === SolidisVerbatimStringReplyByte) {
      const textStart =
        length >= 4 && buffer[dataStart + 3] === SolidisColonByte
          ? dataStart + 4
          : dataStart;

      return buffer.toString('utf8', textStart, dataEnd);
    }

    const data = buffer.subarray(dataStart, dataEnd);

    return length < SolidisBulkZeroCopyThreshold ? Buffer.from(data) : data;
  }

  #readAggregate(type: number): SolidisParserStep {
    const start = this.#offset;
    const lineEnd = this.#findLineEnd(start + 1);

    if (lineEnd === -1) {
      return NeedsMoreData;
    }

    const count = this.#readLength(start + 1, lineEnd);

    this.#offset = lineEnd + 2;

    if (type === SolidisAttributeReplyByte && count <= 0) {
      return NoValue;
    }

    if (count < 0) {
      return null;
    }

    if (count === 0) {
      return createAggregate(type, createItems(type));
    }

    this.#frames.push({
      type,
      items: createItems(type),
      remaining:
        type === SolidisMapReplyByte || type === SolidisAttributeReplyByte
          ? count * 2
          : count,
    });

    return NoValue;
  }

  #findLineEnd(from: number) {
    const buffer = this.#buffer;

    let index = from;

    while (
      index < buffer.length &&
      buffer[index] !== SolidisCarriageReturnByte
    ) {
      index += 1;
    }

    if (index + 1 >= buffer.length) {
      this.#requiredLength = -1;

      return -1;
    }

    if (buffer[index + 1] !== SolidisLineFeedByte) {
      throw new SolidisParserError('Missing CRLF');
    }

    return index;
  }

  #readText(start: number, end: number) {
    return this.#buffer.toString('latin1', start, end);
  }

  #parseInteger(start: number, end: number): number | bigint | undefined {
    const buffer = this.#buffer;
    const isNegative = buffer[start] === SolidisMinusByte;

    let index = isNegative ? start + 1 : start;
    let value = 0;

    if (index === end) {
      return undefined;
    }

    while (index < end) {
      const digit = buffer[index] - SolidisZeroByte;

      if (digit < 0 || digit > 9) {
        return undefined;
      }

      value = value * 10 + digit;
      index += 1;
    }

    if (!Number.isSafeInteger(value)) {
      return BigInt(this.#readText(start, end));
    }

    return isNegative ? -value : value;
  }

  #readLength(start: number, end: number) {
    const length = this.#parseInteger(start, end);

    if (typeof length !== 'number') {
      throw new SolidisParserError(
        `Invalid length '${this.#readText(start, end)}'`,
      );
    }

    return length;
  }

  #readBoolean(start: number, end: number) {
    const value = this.#buffer[start];

    if (
      end !== start + 1 ||
      (value !== SolidisLowercaseTByte && value !== SolidisLowercaseFByte)
    ) {
      throw new SolidisParserError(
        `Boolean: invalid value '${this.#readText(start, end)}'`,
      );
    }

    return value === SolidisLowercaseTByte;
  }

  #readBigNumber(text: string) {
    if (/^-?\d+$/.test(text)) {
      return BigInt(text);
    }

    return new RespError(`BigNumber: '${text}'`);
  }
}
