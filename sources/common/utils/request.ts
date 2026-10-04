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

function findMaskEnd(
  source: string,
  start: number,
  quote: string,
  texts: readonly string[],
  index: number,
) {
  let position = start;

  for (let next = index; next < texts.length; next += 1) {
    const text = texts[next];

    let matched = 0;

    while (
      matched < text.length &&
      source[position + matched] === text[matched]
    ) {
      matched += 1;
    }

    position += matched;

    if (source[position] === quote) {
      return position;
    }

    if (matched < text.length || source[position] !== ' ') {
      return next === index ? -1 : source.indexOf(quote, position);
    }

    position += 1;
  }

  return source.indexOf(quote, position);
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

  const ordered = command
    .slice(visibleLength)
    .map((argument) =>
      toTextPrefix(argument, source.length).replace(/[\r\n]/g, ' '),
    );
  const firstIndexes = new Map<string, number>();

  ordered.forEach((text, index) => {
    if (starts.has(text[0]) && !firstIndexes.has(text)) {
      firstIndexes.set(text, index);
    }
  });

  const texts = [...firstIndexes.keys()].sort();
  const lengths = new Set(texts.map((text) => text.length));

  let result = '';
  let copied = 0;

  for (const { index } of source.matchAll(/['`]/g)) {
    const quote = source[index];
    const start = index + 1;
    const closing = source.indexOf(quote, start);

    if (index < copied || closing === -1) {
      continue;
    }

    const span = source.slice(start, closing);
    const prefix = span + quote;

    let end =
      span !== '' && texts[findLowerBound(texts, span)]?.startsWith(span)
        ? closing
        : -1;

    for (
      let space = span.indexOf(' ');
      space > 0;
      space = span.indexOf(' ', space + 1)
    ) {
      const index = lengths.has(space)
        ? firstIndexes.get(span.slice(0, space))
        : undefined;

      if (index !== undefined) {
        end = Math.max(
          end,
          closing,
          findMaskEnd(source, start, quote, ordered, index),
        );
      }
    }

    for (
      let candidate = findLowerBound(texts, prefix);
      texts[candidate]?.startsWith(prefix);
      candidate += 1
    ) {
      end = Math.max(
        end,
        findMaskEnd(source, start, quote, [texts[candidate]], 0),
      );
    }

    if (end !== -1) {
      result += `${source.slice(copied, start)}***`;
      copied = end;
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
