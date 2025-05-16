import {
  RespError,
  SolidisNumberTypes,
  SolidisParserError,
  SolidisReplyBytes,
  SolidisSymbolBytes,
} from '../index.ts';

import type {
  SolidisClientFrozenOptions,
  SolidisData,
  SolidisParseRequest,
  SolidisParsed,
  SolidisParsedBufferWithLength,
  SolidisRespLengthType,
  SolidisRespPrimitiveType,
  SolidisRespSimpleLineType,
  SolidisRespType,
} from '../index.ts';

export class SolidisParser {
  #buffer: Buffer;
  #shiftThreshold: number;

  #readOffset = 0;
  #writeOffset = 0;

  #parseRequests: SolidisParseRequest[] = [];
  #parseBuffers: Buffer[] = [];

  /** Reserved for future implementation */
  #parsedAttributes: Map<string, SolidisData>[] = [];

  #scheduledParsing?: NodeJS.Immediate;

  constructor(options: SolidisClientFrozenOptions) {
    const {
      parser: {
        buffer: { initial, shiftThreshold },
      },
    } = options;

    this.#buffer = Buffer.allocUnsafe(initial);
    this.#shiftThreshold = shiftThreshold;
  }

  public async queueParse(...buffers: Buffer[]): Promise<SolidisData[]> {
    return new Promise<SolidisData[]>((resolve, reject) => {
      this.#parseRequests.push({ resolve, reject });
      this.#parseBuffers.push(...buffers);

      if (!this.#scheduledParsing) {
        this.#scheduledParsing = setImmediate(() => {
          this.#processParseRequests();

          this.#scheduledParsing = undefined;
        });
      }
    });
  }

  #processParseRequests() {
    let parsedDataArray: SolidisData[] = [];
    let parseError: unknown = null;

    this.#appendBuffers();

    try {
      parsedDataArray = this.#parse();
    } catch (error) {
      parseError = error;
    }

    for (let index = 0; index < this.#parseRequests.length; index += 1) {
      if (parseError) {
        this.#parseRequests[index].reject(parseError);

        continue;
      }

      this.#parseRequests[index].resolve(parsedDataArray);
    }

    this.#parseRequests = [];
  }

  #parse() {
    const parsedDataArray: SolidisData[] = [];

    while (true) {
      const parsed: SolidisParsed = this.#tryParseOnce();

      if (parsed === null) {
        break;
      }

      if (!parsed.ignore) {
        parsedDataArray.push(parsed.data);
      }

      this.#tryShiftInternalBuffer();
    }

    return parsedDataArray;
  }

  #appendBuffers() {
    for (let index = 0; index < this.#parseBuffers.length; index += 1) {
      const parseBuffer = this.#parseBuffers[index];

      if (this.#writeOffset + parseBuffer.length > this.#buffer.length) {
        this.#growInternalBuffer(this.#writeOffset + parseBuffer.length);
      }

      parseBuffer.copy(this.#buffer, this.#writeOffset);

      this.#writeOffset += parseBuffer.length;
    }

    this.#parseBuffers = [];
  }

  #growInternalBuffer(minCapacity: number) {
    let newCapacity = this.#buffer.length;

    while (newCapacity < minCapacity) {
      newCapacity *= 2;
    }

    const newBuffer: Buffer = Buffer.allocUnsafe(newCapacity);

    this.#buffer.copy(newBuffer, 0, this.#readOffset, this.#writeOffset);

    this.#writeOffset -= this.#readOffset;
    this.#readOffset = 0;

    this.#buffer = newBuffer;
  }

  #tryShiftInternalBuffer() {
    if (this.#readOffset === this.#writeOffset) {
      this.#readOffset = 0;
      this.#writeOffset = 0;

      return;
    }

    if (
      this.#readOffset > this.#shiftThreshold &&
      this.#readOffset < this.#writeOffset
    ) {
      const remainingBytes = this.#writeOffset - this.#readOffset;

      this.#buffer.copy(this.#buffer, 0, this.#readOffset, this.#writeOffset);

      this.#readOffset = 0;
      this.#writeOffset = remainingBytes;
    }
  }

  #tryParseOnce(): SolidisParsed {
    if (this.#readOffset >= this.#writeOffset) {
      return null;
    }

    const prefixByte = this.#buffer[this.#readOffset];

    let parsed: SolidisParsed = null;

    switch (prefixByte) {
      /** RESP2 replies */
      case SolidisReplyBytes.BULK: {
        parsed = this.#parseBulkString('Bulk');

        break;
      }

      case SolidisReplyBytes.STRING: {
        parsed = this.#parseSimpleLine('SimpleString');

        break;
      }

      case SolidisReplyBytes.ERROR: {
        parsed = this.#parseSimpleLine('Error');

        break;
      }

      case SolidisReplyBytes.INTEGER: {
        parsed = this.#parseInteger();

        break;
      }

      case SolidisReplyBytes.ARRAY: {
        parsed = this.#parseSequence('Array');

        break;
      }

      /** RESP3 replies */
      case SolidisReplyBytes.PUSH: {
        parsed = this.#parseSequence('Push');

        break;
      }

      case SolidisReplyBytes.NULL: {
        parsed = this.#parseNull();

        break;
      }

      case SolidisReplyBytes.BOOLEAN: {
        parsed = this.#parseBoolean();

        break;
      }

      case SolidisReplyBytes.DOUBLE: {
        parsed = this.#parseDouble();

        break;
      }

      case SolidisReplyBytes.BIG_NUMBER: {
        parsed = this.#parseBigNumber();

        break;
      }

      case SolidisReplyBytes.VERBATIM_STRING: {
        parsed = this.#parseBulkString('VerbatimString');

        break;
      }

      case SolidisReplyBytes.BLOB_ERROR: {
        parsed = this.#parseBulkString('BlobError');

        break;
      }

      case SolidisReplyBytes.SET: {
        parsed = this.#parseSequence('Set', (items) => new Set(items));

        break;
      }

      case SolidisReplyBytes.MAP: {
        parsed = this.#parseMap();

        break;
      }

      case SolidisReplyBytes.ATTRIBUTE: {
        parsed = this.#parseAttribute();

        break;
      }

      default: {
        throw new SolidisParserError(
          `Unknown prefix '${String.fromCharCode(prefixByte)}' in Solidis response`,
        );
      }
    }

    if (parsed === null) {
      return null;
    }

    this.#readOffset += parsed.length;

    return parsed;
  }

  #tryParseAtOffset(startingOffset: number): SolidisParsed {
    const backupReadOffset = this.#readOffset;
    const backupWriteOffset = this.#writeOffset;

    this.#readOffset = startingOffset;

    const parsed: SolidisParsed = this.#tryParseOnce();
    const length = this.#readOffset - startingOffset;

    this.#readOffset = backupReadOffset;
    this.#writeOffset = backupWriteOffset;

    if (parsed === null) {
      return null;
    }

    return {
      data: parsed.data,
      length,
    };
  }

  #parseInteger(): SolidisParsed {
    const parsed = this.#parseNumeric('Integer');

    if (parsed === null) {
      return null;
    }

    return {
      data: parsed.data,
      length: parsed.length,
    };
  }

  #parseBulkString(type: SolidisRespLengthType): SolidisParsed {
    const parsed = this.#parseBufferWithLength(type);

    if (parsed === null) {
      return null;
    }

    let data: SolidisData = null;

    if (parsed.data) {
      switch (type) {
        case 'VerbatimString': {
          data = parsed.data.toString();
          break;
        }

        case 'BlobError': {
          data = new RespError(parsed.data.toString());
          break;
        }

        default: {
          data = Buffer.from(parsed.data);
          break;
        }
      }
    }

    return {
      data,
      length: parsed.length,
    };
  }

  #parseSimpleLine(type: SolidisRespSimpleLineType): SolidisParsed {
    const parsed = this.#parseLine(this.#readOffset + 1, type);

    if (parsed === null) {
      return null;
    }

    const isError = type === 'Error';

    return {
      data: isError ? new RespError(parsed.data) : parsed.data,
      length: parsed.length + 1,
    };
  }

  #parseNull(): SolidisParsed {
    if (this.#writeOffset - this.#readOffset < 3) {
      return null;
    }

    if (!this.#checkCRLF(this.#readOffset + 1, 'Null')) {
      return null;
    }

    return {
      data: null,
      length: 3,
    };
  }

  #parseBoolean(): SolidisParsed {
    const startPosition = this.#readOffset + 1;

    if (!this.#checkCRLF(startPosition + 1, 'Boolean')) {
      return null;
    }

    const boolByte = this.#buffer[startPosition];

    return {
      data: boolByte === SolidisSymbolBytes.LOWER_T,
      length: 4,
    };
  }

  #parseDouble(): SolidisParsed {
    const parsed = this.#parseSimpleLine('Double');

    if (parsed === null || typeof parsed.data !== 'string') {
      return null;
    }

    switch (parsed.data) {
      case SolidisNumberTypes.INFINITY: {
        return {
          data: Number.POSITIVE_INFINITY,
          length: parsed.length,
        };
      }

      case SolidisNumberTypes.NEGATIVE_INFINITY: {
        return {
          data: Number.NEGATIVE_INFINITY,
          length: parsed.length,
        };
      }

      case SolidisNumberTypes.NAN: {
        return {
          data: Number.NaN,
          length: parsed.length,
        };
      }

      default: {
        break;
      }
    }

    const parsedNumber = Number.parseFloat(parsed.data);

    return {
      data: Number.isNaN(parsedNumber)
        ? new RespError(`Double parse error: '${parsed.data}'`)
        : parsedNumber,
      length: parsed.length,
    };
  }

  #parseBigNumber(): SolidisParsed {
    const parsed = this.#parseSimpleLine('BigNumber');

    if (parsed === null || typeof parsed.data !== 'string') {
      return null;
    }

    try {
      return {
        data: BigInt(parsed.data),
        length: parsed.length,
      };
    } catch {
      return {
        data: new RespError(`BigNumber parse error: '${parsed.data}'`),
        length: parsed.length,
      };
    }
  }

  #parseMap(): SolidisParsed {
    const lengthObject = this.#parseLength('Map');

    if (!lengthObject) {
      return null;
    }

    const { data: lengthData, length: lengthLength } = lengthObject;

    const startPosition = this.#readOffset + 1 + lengthLength;

    if (lengthData < 0) {
      return {
        data: null,
        length: 1 + lengthLength,
      };
    }

    let offset = startPosition;

    const map = new Map<string, SolidisData>();

    for (let index = 0; index < lengthData; index += 1) {
      if (offset >= this.#writeOffset) {
        return null;
      }

      const key = this.#tryParseAtOffset(offset);

      if (!key) {
        return null;
      }

      offset += key.length;

      if (offset >= this.#writeOffset) {
        return null;
      }

      const value = this.#tryParseAtOffset(offset);

      if (!value) {
        return null;
      }

      offset += value.length;

      if (key.data) {
        map.set(key.data.toString(), value.data);
      }
    }

    return {
      data: map,
      length: offset - this.#readOffset,
    };
  }

  #parseAttribute(): SolidisParsed {
    const parsed = this.#parseMap();

    if (!parsed) {
      return null;
    }

    if (parsed.data instanceof Map) {
      this.#parsedAttributes.push(parsed.data);
    }

    return {
      data: null,
      length: parsed.length,
      ignore: true,
    };
  }

  #parseSequence<T extends SolidisData>(
    type: SolidisRespLengthType,
    transform?: (items: SolidisData[]) => T,
  ): SolidisParsed {
    const lengthObject = this.#parseLength(type);

    if (!lengthObject) {
      return null;
    }

    const { data: lengthData, length: lengthLength } = lengthObject;

    if (lengthData < 0) {
      return {
        data: null,
        length: 1 + lengthLength,
      };
    }

    const items: SolidisData[] = [];

    let position = this.#readOffset + 1 + lengthLength;

    for (let index = 0; index < lengthData; index += 1) {
      if (position >= this.#writeOffset) {
        return null;
      }

      const parsed = this.#tryParseAtOffset(position);

      if (!parsed) {
        return null;
      }

      items.push(parsed.data);

      position += parsed.length;
    }

    return {
      data: transform ? transform(items) : items,
      length: position - this.#readOffset,
    };
  }

  #parseNumeric(type: SolidisRespLengthType | SolidisRespPrimitiveType) {
    const startPosition = this.#readOffset + 1;
    const endPosition = this.#writeOffset;

    if (startPosition >= endPosition) {
      return null;
    }

    let signIndicator = 1;
    let number = 0;

    let position = startPosition;

    if (this.#buffer[position] === SolidisReplyBytes.ERROR) {
      signIndicator = -1;
      position += 1;
    }

    while (position < endPosition) {
      const character = this.#buffer[position];

      position += 1;

      if (character === SolidisSymbolBytes.CR) {
        if (!this.#checkCRLF(position - 1, type)) {
          return null;
        }

        return {
          data: signIndicator * number,
          length: position - this.#readOffset + 1,
        };
      }

      number = number * 10 + (character - SolidisSymbolBytes.ZERO);
    }

    return null;
  }

  #parseLength(type: SolidisRespLengthType) {
    const parsed = this.#parseNumeric(type);

    if (parsed === null) {
      return null;
    }

    return {
      data: parsed.data,
      length: parsed.length - 1,
    };
  }

  #parseBufferWithLength(
    type: SolidisRespLengthType,
  ): SolidisParsedBufferWithLength {
    const lengthObject = this.#parseLength(type);

    if (lengthObject === null) {
      return null;
    }

    const { data: lengthData, length: lengthLength } = lengthObject;

    if (lengthData < 0) {
      return {
        data: null,
        length: 1 + lengthLength,
      };
    }

    const startPosition = this.#readOffset + 1 + lengthLength;
    const endPosition = startPosition + lengthData;

    if (endPosition + 2 > this.#writeOffset) {
      return null;
    }

    const dataBuffer = this.#buffer.subarray(startPosition, endPosition);
    const totalLength = lengthLength + lengthData + 3;

    return {
      data: dataBuffer,
      length: totalLength,
    };
  }

  #parseLine(startPosition: number, type: SolidisRespSimpleLineType) {
    const endPosition = this.#writeOffset;

    if (startPosition >= endPosition) {
      return null;
    }

    let position = startPosition;

    while (position < endPosition) {
      const character = this.#buffer[position];

      position += 1;

      if (character === SolidisSymbolBytes.CR) {
        if (!this.#checkCRLF(position - 1, type)) {
          return null;
        }

        return {
          data: this.#buffer.toString('utf8', startPosition, position - 1),
          length: position - startPosition + 1,
        };
      }
    }

    return null;
  }

  #checkCRLF(position: number, type: SolidisRespType) {
    if (position + 1 >= this.#writeOffset) {
      return false;
    }

    if (
      this.#buffer[position] !== SolidisSymbolBytes.CR ||
      this.#buffer[position + 1] !== SolidisSymbolBytes.LF
    ) {
      throw new SolidisParserError(`${type} parse error: missing CRLF`);
    }

    return true;
  }
}
