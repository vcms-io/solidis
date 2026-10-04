import {
  SolidisAsteriskByte,
  SolidisCarriageReturnByte,
  SolidisContainerCommandNameSet,
  SolidisDollarByte,
  SolidisLineFeedByte,
} from '../internal.ts';
import { RespError, SolidisCommandError } from './error.ts';
import { toTextPrefix } from './internal.ts';

import type { StringOrBuffer } from '../../types/solidis.ts';

const numberTextCache = Array.from({ length: 8192 }, (_, index) => `${index}`);

function getNumberText(value: number) {
  return numberTextCache[value] ?? `${value}`;
}

function writeCRLF(buffer: Buffer, offset: number) {
  buffer[offset] = SolidisCarriageReturnByte;
  buffer[offset + 1] = SolidisLineFeedByte;

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
    result[offset] = SolidisAsteriskByte;

    offset = writeAsciiNumber(result, commandArguments.length, offset + 1);
    offset = writeCRLF(result, offset);

    for (const argument of commandArguments) {
      const argumentLength = argumentLengths[argumentIndex];

      argumentIndex += 1;
      result[offset] = SolidisDollarByte;

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

function toText(value: unknown) {
  try {
    return String(value);
  } catch {
    return '?';
  }
}

export function getCommandName(command: readonly StringOrBuffer[]): string {
  const name = toText(command[0] ?? '').toUpperCase();
  const subcommand = command[1];

  if (subcommand === undefined || !SolidisContainerCommandNameSet.has(name)) {
    return name;
  }

  return `${name} ${toText(subcommand).toUpperCase()}`;
}

function findLowerBound(texts: readonly string[], text: string) {
  let low = 0;
  let high = texts.length;

  while (low < high) {
    const middle = (low + high) >>> 1;

    if (texts[middle] < text) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function redactArguments(
  message: string,
  command: readonly StringOrBuffer[],
  visibleLength: number,
) {
  const source = message.replace(/\uFFFD+(?=['`])/g, '');
  const starts = new Set(source.match(/(?<=['`])./gs));

  if (starts.size === 0) {
    return source;
  }

  const texts = command
    .slice(visibleLength)
    .map((argument) =>
      toTextPrefix(argument, source.length).replace(/[\r\n]/g, ' '),
    );
  const joined = texts.join('');
  const innerQuotes = ["'", '`'].filter((quote) => joined.includes(quote));
  const candidates = new Set(texts.filter((text) => starts.has(text[0])));
  const sorted = [...candidates].sort();
  const lengths = new Set(sorted.map((text) => text.length));

  let result = '';
  let copied = 0;
  let cursor = 0;

  for (const { index } of source.matchAll(/['`]/g)) {
    const quote = source[index];
    const start = index + 1;
    const closing = source.indexOf(quote, start);

    if (index < cursor || closing === -1) {
      continue;
    }

    const span = source.slice(start, closing);

    let isArgument =
      span !== '' && sorted[findLowerBound(sorted, span)]?.startsWith(span);

    for (
      let space = span.indexOf(' ');
      !isArgument && space > 0;
      space = span.indexOf(' ', space + 1)
    ) {
      isArgument = lengths.has(space) && candidates.has(span.slice(0, space));
    }

    if (isArgument) {
      const end = innerQuotes.includes(quote)
        ? source.lastIndexOf(quote)
        : closing;

      result += `${source.slice(copied, start)}***`;
      copied = end;
      cursor = end + 1;
    }
  }

  return result + source.slice(copied);
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
