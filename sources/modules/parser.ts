import {
  RespError,
  RespPush,
  SolidisNumberTypes,
  SolidisParserError,
  SolidisReplyBytes,
  SolidisSymbolBytes,
} from '../index.ts';

import type {
  SolidisClientFrozenOptions,
  SolidisData,
  SolidisParsed,
  SolidisParsedBufferWithLength,
  SolidisRespLengthType,
  SolidisRespPrimitiveType,
  SolidisRespSimpleLineType,
  SolidisRespType,
} from '../index.ts';

export class SolidisParser {
  #buffer: Buffer;
  #bufferHasBorrowedSlices = false;
  #bufferIsExternal = false;
  #initialBufferSize: number;
  #shiftThreshold: number;
  #maxBulkStringLength: number;

  #readOffset = 0;
  #writeOffset = 0;

  constructor(options: SolidisClientFrozenOptions) {
    const {
      parser: {
        buffer: { initial, shiftThreshold },
        maxBulkStringLength,
      },
    } = options;

    this.#buffer = Buffer.allocUnsafe(initial);
    this.#initialBufferSize = initial;
    this.#shiftThreshold = shiftThreshold;
    this.#maxBulkStringLength = maxBulkStringLength;
  }

  public async queueParse(...buffers: Buffer[]): Promise<SolidisData[]> {
    return this.#parseBuffers(buffers);
  }

  #parseBuffers(buffers: Buffer[]) {
    const parsedDataArray: SolidisData[] = [];

    for (let index = 0; index < buffers.length; index += 1) {
      this.#appendBuffer(buffers[index]);

      this.#parse(parsedDataArray);
    }

    return parsedDataArray;
  }

  #parse(parsedDataArray: SolidisData[]) {
    while (true) {
      const parsed: SolidisParsed = this.#tryParseOnce();

      if (parsed === null) {
        return;
      }

      if (!parsed.ignore) {
        parsedDataArray.push(parsed.data);
      }

      this.#tryShiftInternalBuffer();
    }
  }

  #appendBuffer(parseBuffer: Buffer) {
    if (this.#readOffset === this.#writeOffset) {
      this.#buffer = parseBuffer;
      this.#bufferHasBorrowedSlices = false;
      this.#bufferIsExternal = true;
      this.#readOffset = 0;
      this.#writeOffset = parseBuffer.length;

      return;
    }

    if (this.#bufferIsExternal) {
      this.#moveUnreadBytesToInternalBuffer(parseBuffer.length);
    }

    if (this.#writeOffset + parseBuffer.length > this.#buffer.length) {
      this.#growInternalBuffer(this.#writeOffset + parseBuffer.length);
    }

    parseBuffer.copy(this.#buffer, this.#writeOffset);

    this.#writeOffset += parseBuffer.length;
  }

  #moveUnreadBytesToInternalBuffer(additionalCapacity: number) {
    const remainingBytes = this.#writeOffset - this.#readOffset;
    const minCapacity = remainingBytes + additionalCapacity;
    const newBuffer = this.#allocateInternalBuffer(minCapacity);

    this.#buffer.copy(newBuffer, 0, this.#readOffset, this.#writeOffset);

    this.#buffer = newBuffer;
    this.#bufferHasBorrowedSlices = false;
    this.#bufferIsExternal = false;
    this.#readOffset = 0;
    this.#writeOffset = remainingBytes;
  }

  #allocateInternalBuffer(minCapacity: number) {
    let newCapacity = Math.max(this.#initialBufferSize, this.#buffer.length);

    while (newCapacity < minCapacity) {
      newCapacity *= 2;
    }

    return Buffer.allocUnsafe(newCapacity);
  }

  #growInternalBuffer(minCapacity: number) {
    const newBuffer = this.#allocateInternalBuffer(minCapacity);

    this.#buffer.copy(newBuffer, 0, this.#readOffset, this.#writeOffset);

    this.#writeOffset -= this.#readOffset;
    this.#readOffset = 0;

    this.#buffer = newBuffer;
    this.#bufferHasBorrowedSlices = false;
    this.#bufferIsExternal = false;
  }

  #tryShiftInternalBuffer() {
    if (this.#readOffset === this.#writeOffset) {
      this.#readOffset = 0;
      this.#writeOffset = 0;

      return;
    }

    if (this.#bufferIsExternal || this.#bufferHasBorrowedSlices) {
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
        parsed = this.#parseSequence('Push', (items) => RespPush.from(items));

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

  #parseInteger(): SolidisParsed {
    try {
      const parsed = this.#parseNumeric('Integer');

      if (parsed === null) {
        return null;
      }

      if (parsed.digitCount > 15 && !Number.isSafeInteger(parsed.data)) {
        const numString = this.#buffer.toString(
          'ascii',
          this.#readOffset + 1,
          this.#readOffset + parsed.length - 2,
        );

        return {
          data: BigInt(numString),
          length: parsed.length,
        };
      }

      return {
        data: parsed.data,
        length: parsed.length,
      };
    } catch {
      const line = this.#parseLine(this.#readOffset + 1, 'Integer');

      if (line === null) {
        return null;
      }

      return {
        data: new RespError(`Integer parse error: '${line.data}'`),
        length: line.length + 1,
      };
    }
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
          data = this.#borrowParsedBuffer(parsed.data);
          break;
        }
      }
    }

    return {
      data,
      length: parsed.length,
    };
  }

  #borrowParsedBuffer(buffer: Buffer) {
    if (!this.#bufferIsExternal) {
      this.#bufferHasBorrowedSlices = true;
    }

    return buffer;
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

    if (
      boolByte !== SolidisSymbolBytes.LOWER_T &&
      boolByte !== SolidisSymbolBytes.LOWER_F
    ) {
      throw new SolidisParserError(
        `Boolean parse error: invalid value byte 0x${boolByte.toString(16)}`,
      );
    }

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

  #nullLengthResult(lengthLength: number) {
    return { data: null, length: 1 + lengthLength } as const;
  }

  #parseMap(): SolidisParsed {
    const lengthObject = this.#parseLength('Map');

    if (!lengthObject) {
      return null;
    }

    const { data: lengthData, length: lengthLength } = lengthObject;

    if (lengthData < 0) {
      return this.#nullLengthResult(lengthLength);
    }

    const map = new Map<string, SolidisData>();

    const readOffsetState = this.#readOffset;

    this.#readOffset += 1 + lengthLength;

    for (let index = 0; index < lengthData; index += 1) {
      if (this.#readOffset >= this.#writeOffset) {
        this.#readOffset = readOffsetState;

        return null;
      }

      const key: SolidisParsed = this.#tryParseOnce();

      if (key === null) {
        this.#readOffset = readOffsetState;

        return null;
      }

      if (this.#readOffset >= this.#writeOffset) {
        this.#readOffset = readOffsetState;

        return null;
      }

      const value: SolidisParsed = this.#tryParseOnce();

      if (value === null) {
        this.#readOffset = readOffsetState;

        return null;
      }

      if (key.data !== null) {
        map.set(key.data.toString(), value.data);
      }
    }

    const totalLength = this.#readOffset - readOffsetState;

    this.#readOffset = readOffsetState;

    return {
      data: map,
      length: totalLength,
    };
  }

  #parseAttribute(): SolidisParsed {
    const parsed = this.#parseMap();

    if (!parsed) {
      return null;
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
      return this.#nullLengthResult(lengthLength);
    }

    const items = new Array<SolidisData>(lengthData);

    const readOffsetState = this.#readOffset;

    this.#readOffset += 1 + lengthLength;

    for (let index = 0; index < lengthData; index += 1) {
      if (this.#readOffset >= this.#writeOffset) {
        this.#readOffset = readOffsetState;

        return null;
      }

      const parsed: SolidisParsed = this.#tryParseOnce();

      if (parsed === null) {
        this.#readOffset = readOffsetState;

        return null;
      }

      items[index] = parsed.data;
    }

    const totalLength = this.#readOffset - readOffsetState;

    this.#readOffset = readOffsetState;

    return {
      data: transform ? transform(items) : items,
      length: totalLength,
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
    let digitCount = 0;

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
          digitCount,
        };
      }

      if (
        character < SolidisSymbolBytes.ZERO ||
        character > SolidisSymbolBytes.ZERO + 9
      ) {
        throw new SolidisParserError(
          `${type} parse error: non-digit byte 0x${character.toString(16)}`,
        );
      }

      number = number * 10 + (character - SolidisSymbolBytes.ZERO);
      digitCount += 1;
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
      return this.#nullLengthResult(lengthLength);
    }

    if (lengthData > this.#maxBulkStringLength) {
      throw new SolidisParserError(
        `${type} length ${lengthData} exceeds maximum allowed ${this.#maxBulkStringLength}`,
      );
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

  #parseLine(startPosition: number, type: SolidisRespType) {
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
