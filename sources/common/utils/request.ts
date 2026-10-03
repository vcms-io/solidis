import { SolidisContainerCommandNameSet } from '../constants.ts';
import {
  SolidisAsteriskByte,
  SolidisCarriageReturnByte,
  SolidisDollarByte,
  SolidisLineFeedByte,
} from '../internal.ts';
import { RespError, SolidisCommandError } from './error.ts';

import type { StringOrBuffer } from '../../types/solidis.ts';

const ASTERISK = SolidisAsteriskByte;
const DOLLAR = SolidisDollarByte;
const CR = SolidisCarriageReturnByte;
const LF = SolidisLineFeedByte;

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

function redactArguments(
  message: string,
  command: readonly StringOrBuffer[],
  visibleLength: number,
) {
  let result = message;

  for (const argument of command.slice(visibleLength)) {
    const text = String(argument).replace(/[\r\n]/g, ' ');

    if (!text || !result.includes(`'${text[0]}`)) {
      continue;
    }

    for (
      let length = Math.min(text.length, result.length);
      length > 0;
      length -= 1
    ) {
      const quoted = `'${text.slice(0, length)}'`;

      if (result.includes(quoted)) {
        result = result.replaceAll(quoted, "'***'");

        break;
      }
    }
  }

  return result;
}

export function toCommandError(
  reply: RespError,
  command: readonly StringOrBuffer[],
): SolidisCommandError {
  const name = getCommandName(command);
  const message = redactArguments(
    reply.message,
    command,
    name.split(' ').length,
  );

  return new SolidisCommandError(
    `[${name}] ${message}`,
    message === reply.message ? reply : new RespError(message),
  );
}
