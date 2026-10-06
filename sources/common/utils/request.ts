import {
  SolidisAsteriskByte,
  SolidisCarriageReturnByte,
  SolidisContainerCommandNameSet,
  SolidisDollarByte,
  SolidisLineFeedByte,
  SolidisMaskingSearchLimit,
  SolidisMaximumErrorMessageLength,
} from '../internal.ts';
import { RespError, SolidisCommandError } from './error.ts';
import { toTextPrefix } from './internal.ts';

import type { StringOrBuffer } from '../../types/solidis.ts';

function writeCRLF(buffer: Buffer, offset: number) {
  buffer[offset] = SolidisCarriageReturnByte;
  buffer[offset + 1] = SolidisLineFeedByte;

  return offset + 2;
}

function writeAsciiNumber(buffer: Buffer, value: number, offset: number) {
  return offset + buffer.write(`${value}`, offset, 'ascii');
}

export function commandsToBuffer(commands: StringOrBuffer[][]): Buffer {
  const argumentLengths: number[] = [];

  let totalLength = 0;

  for (const commandArguments of commands) {
    totalLength += 3 + `${commandArguments.length}`.length;

    for (const argument of commandArguments) {
      const argumentLength = Buffer.byteLength(argument);

      argumentLengths.push(argumentLength);

      totalLength += 5 + `${argumentLength}`.length + argumentLength;
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

function redactArguments(
  message: string,
  command: readonly StringOrBuffer[],
  visibleLength: number,
) {
  const text = message.slice(0, SolidisMaximumErrorMessageLength);
  const isCut = message.length > SolidisMaximumErrorMessageLength;
  const starts = new Set(text.match(/(?<=['`])./gs));

  if (starts.size === 0) {
    return text;
  }

  const hiddenArguments = command.slice(visibleLength);
  const candidates = new Set(
    hiddenArguments
      .map((argument) =>
        toTextPrefix(argument, text.length).replace(
          /[\r\n]|\p{Cs}/gu,
          (character) => (character < ' ' ? ' ' : '\uFFFD'),
        ),
      )
      .filter((candidate) => starts.has(candidate[0])),
  );
  const lengths = new Set([...candidates].map((candidate) => candidate.length));
  const searched = [...candidates, ...hiddenArguments];
  const searchCost = searched.reduce(
    (cost, value) => cost + value.length + 32,
    0,
  );

  let searchBudget = /user_(?:script|function):/.test(text)
    ? -1
    : SolidisMaskingSearchLimit + searchCost;

  for (const { index } of text.matchAll(/['`]/g)) {
    const quote = text[index];
    let closing = text.indexOf(quote, index + 1);

    if (closing < 0 && isCut) {
      closing = text.length;
    }

    if (closing < 0) {
      continue;
    }

    const span = text.slice(index + 1, closing);
    const pieces = span.trim() && span.split(/[\p{Cs}\uFFFD]+/u);

    searchBudget -= searchCost * (pieces.length || 1);

    let isArgument =
      searchBudget < 0 ||
      searched.some((value) =>
        pieces
          ? pieces.every((piece) => value.includes(piece))
          : typeof value === 'string' && value.startsWith(span || quote),
      );

    for (
      let space = span.indexOf(' ');
      !isArgument && space > 0;
      space = span.indexOf(' ', space + 1)
    ) {
      isArgument = lengths.has(space) && candidates.has(span.slice(0, space));
    }

    if (isArgument) {
      return `${text.slice(0, index + 1)}***${isCut ? '' : text.slice(Math.max(text.lastIndexOf("'"), text.lastIndexOf('`')))}`;
    }
  }

  return text;
}

export function toCommandError(
  reply: RespError,
  command: readonly StringOrBuffer[],
): SolidisCommandError {
  const name = getCommandName(command);
  const message = redactArguments(
    reply.message,
    command,
    name === toText(command[0]).toUpperCase() ? 1 : 2,
  );

  return new SolidisCommandError(
    `[${name}] ${message}`,
    message === reply.message ? reply : new RespError(message),
  );
}
