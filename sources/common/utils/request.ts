import { SolidisSymbolBytes } from '../constants.ts';

import type { StringOrBuffer } from '../../index.ts';

const { ASTERISK, DOLLAR, CR, LF } = SolidisSymbolBytes;

const numberTextCache = Array.from({ length: 8192 }, (_, index) => `${index}`);

function getNumberText(value: number) {
  return numberTextCache[value] ?? `${value}`;
}

function writeCRLF(buffer: Buffer, offset: number) {
  buffer[offset] = CR;
  buffer[offset + 1] = LF;

  return offset + 2;
}

function writeAsciiNumber(buffer: Buffer, value: number, offset: number) {
  return offset + buffer.write(getNumberText(value), offset, 'ascii');
}

export function commandsToBuffer(commands: StringOrBuffer[][]): Buffer {
  let totalLength = 0;

  for (const commandArguments of commands) {
    totalLength += 3 + getNumberText(commandArguments.length).length;

    for (const argument of commandArguments) {
      const argumentLength = Buffer.isBuffer(argument)
        ? argument.length
        : Buffer.byteLength(argument);

      totalLength += 5 + getNumberText(argumentLength).length + argumentLength;
    }
  }

  const result = Buffer.allocUnsafe(totalLength);

  let offset = 0;

  for (const commandArguments of commands) {
    result[offset] = ASTERISK;

    offset = writeAsciiNumber(result, commandArguments.length, offset + 1);
    offset = writeCRLF(result, offset);

    for (const argument of commandArguments) {
      const isBuffer = Buffer.isBuffer(argument);
      const argumentLength = isBuffer
        ? argument.length
        : Buffer.byteLength(argument);

      result[offset] = DOLLAR;

      offset = writeAsciiNumber(result, argumentLength, offset + 1);
      offset = writeCRLF(result, offset);

      if (isBuffer) {
        argument.copy(result, offset);
      } else {
        result.write(argument, offset, 'utf8');
      }

      offset += argumentLength;
      offset = writeCRLF(result, offset);
    }
  }

  if (offset !== totalLength) {
    return result.subarray(0, offset);
  }

  return result;
}

export function extractNextChunkToWrite(
  buffer: Buffer,
  offset: number,
  maxSize: number,
): Buffer {
  const endOffset = Math.min(offset + maxSize, buffer.length);

  return buffer.subarray(offset, endOffset);
}
