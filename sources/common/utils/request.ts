import {
  SolidisContainerCommandNameSet,
  SolidisSymbolBytes,
} from '../constants.ts';

import type { StringOrBuffer } from '../../types/solidis.ts';

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
  const argumentLengths: number[] = [];

  let totalLength = 0;

  for (const commandArguments of commands) {
    totalLength += 3 + getNumberText(commandArguments.length).length;

    for (const argument of commandArguments) {
      const argumentLength = Buffer.byteLength(argument);

      argumentLengths.push(argumentLength);

      totalLength += 5 + getNumberText(argumentLength).length + argumentLength;
    }
  }

  const result = Buffer.allocUnsafe(totalLength);

  let offset = 0;
  let argumentIndex = 0;

  for (const commandArguments of commands) {
    result[offset] = ASTERISK;

    offset = writeAsciiNumber(result, commandArguments.length, offset + 1);
    offset = writeCRLF(result, offset);

    for (const argument of commandArguments) {
      const argumentLength = argumentLengths[argumentIndex];

      argumentIndex += 1;
      result[offset] = DOLLAR;

      offset = writeAsciiNumber(result, argumentLength, offset + 1);
      offset = writeCRLF(result, offset);

      if (Buffer.isBuffer(argument)) {
        argument.copy(result, offset);
      } else {
        result.write(argument, offset);
      }

      offset += argumentLength;
      offset = writeCRLF(result, offset);
    }
  }

  return result;
}

export function getCommandName(command: readonly StringOrBuffer[]): string {
  const name = String(command[0] ?? '').toUpperCase();
  const subcommand = command[1];

  if (subcommand === undefined || !SolidisContainerCommandNameSet.has(name)) {
    return name;
  }

  return `${name} ${String(subcommand).toUpperCase()}`;
}
