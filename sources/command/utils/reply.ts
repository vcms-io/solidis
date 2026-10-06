import { RespError, SolidisCommandError } from '../../common/utils/error.ts';
import { isStringOrBuffer, readText } from '../../common/utils/internal.ts';
import { formatDouble, parseDouble } from '../../common/utils/number.ts';
import { getCommandName } from '../../common/utils/request.ts';
import { RespOK } from '../../types/resp.ts';

import type {
  CommandBufferOptions,
  CommandGeoRadiusOptions,
  CommandGeoSearchOptions,
  CommandIntegerOptions,
} from '../../types/command.ts';
import type {
  RespGeoRadius,
  RespInteger,
  RespLmpop,
  RespModuleInfo,
  RespSortedSetMember,
  RespStreamDeletedEntry,
  RespStreamEntry,
  RespStreamGroupReadResult,
  RespStreamReadResult,
  RespString,
} from '../../types/resp.ts';
import type { SolidisData, StringOrBuffer } from '../../types/solidis.ts';

type CommandName = string | StringOrBuffer[];

export const UnexpectedReplyPrefix = 'Unexpected reply';

export function describeReply(reply: unknown): string {
  if (reply === null) {
    return 'null';
  }

  if (Buffer.isBuffer(reply)) {
    return `Buffer(${reply.length})`;
  }

  if (Array.isArray(reply)) {
    return `Array(${reply.length})`;
  }

  if (reply instanceof Map || reply instanceof Set) {
    return `${reply.constructor.name}(${reply.size})`;
  }

  if (reply instanceof Error) {
    return reply.name;
  }

  return typeof reply;
}

export function newCommandError(
  message: string,
  commandName?: CommandName,
  cause?: unknown,
) {
  return new SolidisCommandError(
    commandName === undefined
      ? message
      : `[${typeof commandName === 'string' ? commandName : getCommandName(commandName)}] ${message}`,
    cause,
  );
}

export function newUnexpectedReplyError(
  reply: unknown,
  commandName?: CommandName,
) {
  return newCommandError(
    `${UnexpectedReplyPrefix}: ${describeReply(reply)}`,
    commandName,
  );
}

export function setRecordEntry<T>(
  record: Record<string, T>,
  key: string,
  value: T,
) {
  if (key === '__proto__') {
    Object.defineProperty(record, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });

    return;
  }

  record[key] = value;
}

export function tryReplyOK(reply: unknown, commandName?: CommandName): RespOK {
  if (reply === RespOK) {
    return RespOK;
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyOKOrNull(
  reply: unknown,
  commandName?: CommandName,
): RespOK | null {
  return reply === null ? null : tryReplyOK(reply, commandName);
}

export function tryReplyToBoolean(
  reply: unknown,
  commandName?: CommandName,
): boolean {
  if (typeof reply === 'boolean') {
    return reply;
  }

  if (reply === 0 || reply === 1) {
    return reply === 1;
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyToBooleanArray(
  reply: unknown,
  commandName?: CommandName,
): boolean[] {
  return tryReplyArray(reply, commandName).map((value) =>
    tryReplyToBoolean(value, commandName),
  );
}

export function tryReplyToString(
  reply: unknown,
  commandName?: CommandName,
): string {
  const text = readText(reply);

  if (text === undefined) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return text;
}

export function tryReplyToStringOrNull(
  reply: unknown,
  commandName?: CommandName,
): string | null {
  return tryReplyToStringOrBufferOrNull(reply, commandName, undefined);
}

export function tryReplyToStringOrBuffer<
  Options extends CommandBufferOptions | undefined,
>(
  reply: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): RespString<Options> {
  if (options?.buffer !== true) {
    return tryReplyToString(reply, commandName) as RespString<Options>;
  }

  return (
    Buffer.isBuffer(reply)
      ? reply
      : Buffer.from(tryReplyToString(reply, commandName))
  ) as RespString<Options>;
}

export function tryReplyToStringOrBufferOrNull<
  Options extends CommandBufferOptions | undefined,
>(
  reply: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): RespString<Options> | null {
  return reply === null
    ? null
    : tryReplyToStringOrBuffer(reply, commandName, options);
}

export function tryReplyToBinaryString(
  reply: unknown,
  commandName?: CommandName,
): string {
  if (Buffer.isBuffer(reply)) {
    return reply.toString('latin1');
  }

  if (typeof reply === 'string') {
    return reply;
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyToBinaryStringOrNull(
  reply: unknown,
  commandName?: CommandName,
): string | null {
  return reply === null ? null : tryReplyToBinaryString(reply, commandName);
}

export function tryReplyNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'number') {
    return reply;
  }

  if (typeof reply === 'bigint') {
    throw newCommandError(
      `${UnexpectedReplyPrefix}: integer exceeds Number.MAX_SAFE_INTEGER`,
      commandName,
      reply,
    );
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyNumberOrNull(
  reply: unknown,
  commandName?: CommandName,
): number | null {
  return reply === null ? null : tryReplyNumber(reply, commandName);
}

function readInteger(reply: unknown) {
  const text = readText(reply);

  if (text === undefined || !/^-?\d{1,19}$/.test(text)) {
    return reply;
  }

  const value = Number(text);

  return Number.isSafeInteger(value) ? value : BigInt(text);
}

export function tryReplyToInteger<
  Options extends CommandIntegerOptions | undefined = undefined,
>(
  reply: unknown,
  commandName?: CommandName,
  options?: Options,
): RespInteger<Options> {
  const value = readInteger(reply);

  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw newUnexpectedReplyError(value, commandName);
  }

  if (options?.bigint !== true) {
    return tryReplyNumber(value, commandName) as RespInteger<Options>;
  }

  return (
    typeof value === 'bigint'
      ? value
      : BigInt(tryReplyNumber(value, commandName))
  ) as RespInteger<Options>;
}

export function tryReplyToNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'boolean') {
    return reply ? 1 : 0;
  }

  return (
    parseDouble(readText(reply) ?? '') ?? tryReplyNumber(reply, commandName)
  );
}

export function tryReplyToNumberOrNull(
  reply: unknown,
  commandName?: CommandName,
): number | null {
  return reply === null ? null : tryReplyToNumber(reply, commandName);
}

export function processPairedArray(
  array: unknown,
  processor: (key: string, value: unknown) => void,
  commandName?: CommandName,
) {
  const items = array instanceof Map ? [...array].flat() : array;

  if (!Array.isArray(items)) {
    throw newUnexpectedReplyError(array, commandName);
  }

  if (items.length % 2 !== 0) {
    throw newCommandError(
      `${UnexpectedReplyPrefix}: expected even-length array, got ${items.length}`,
      commandName,
    );
  }

  for (let index = 0; index < items.length; index += 2) {
    const key = items[index];

    processor(readText(key) ?? `${key}`, items[index + 1]);
  }
}

export function tryReplyArray(
  reply: SolidisData,
  commandName?: CommandName,
): SolidisData[];
export function tryReplyArray(
  reply: unknown,
  commandName?: CommandName,
): unknown[];
export function tryReplyArray(
  reply: unknown,
  commandName?: CommandName,
): unknown[] {
  if (Array.isArray(reply)) {
    return reply;
  }

  if (reply instanceof Set) {
    return [...reply];
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyTuple(
  reply: unknown,
  length: number,
  commandName?: CommandName,
): unknown[] {
  const tuple = tryReplyArray(reply, commandName);

  if (tuple.length !== length) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return tuple;
}

export function tryReplyToStringArray(
  reply: unknown,
  commandName?: CommandName,
): string[] {
  return tryReplyArray(reply, commandName).map((item) =>
    tryReplyToString(item, commandName),
  );
}

export function tryReplyToStringOrBufferArray<
  Options extends CommandBufferOptions | undefined,
>(
  reply: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): RespString<Options>[] {
  return tryReplyArray(reply, commandName).map((item) =>
    tryReplyToStringOrBuffer(item, commandName, options),
  );
}

export function tryReplyToNullableStringOrBufferArray<
  Options extends CommandBufferOptions | undefined,
>(
  reply: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): (RespString<Options> | null)[] {
  return tryReplyArray(reply, commandName).map((item) =>
    tryReplyToStringOrBufferOrNull(item, commandName, options),
  );
}

export function tryReplyToNullableStringArray(
  reply: unknown,
  commandName?: CommandName,
): (string | null)[] {
  return tryReplyToNullableStringOrBufferArray(reply, commandName, undefined);
}

export function tryReplyToNumberArray(
  reply: unknown,
  commandName: CommandName | undefined,
  nullable: true,
): (number | null)[];
export function tryReplyToNumberArray(
  reply: unknown,
  commandName: CommandName | undefined,
  nullable: false,
): number[];
export function tryReplyToNumberArray(
  reply: unknown,
  commandName?: CommandName,
): number[];
export function tryReplyToNumberArray(
  reply: unknown,
  commandName?: CommandName,
  nullable = false,
): number[] | (number | null)[] {
  return tryReplyArray(reply, commandName).map((value) =>
    nullable
      ? tryReplyToNumberOrNull(value, commandName)
      : tryReplyToNumber(value, commandName),
  );
}

export function tryReplyToNumberOrErrorArray(
  reply: SolidisData,
  commandName: CommandName | undefined,
  length: number,
): (number | RespError)[] {
  const results = tryReplyArray(reply, commandName).map((item) =>
    item instanceof Error ? item : tryReplyToNumber(item, commandName),
  );
  const last = results.at(-1);

  while (results.length < length && last instanceof Error) {
    results.push(last);
  }

  return results;
}

export function tryReplyToNullableNumberArray(
  reply: unknown,
  commandName?: CommandName,
): (number | null)[] {
  return tryReplyToNumberArray(reply, commandName, true);
}

export function tryReplyToSortedSetMembers(
  reply: unknown,
  commandName?: CommandName,
): RespSortedSetMember[] {
  const result: RespSortedSetMember[] = [];

  processPairedArray(
    tryReplyArray(reply, commandName).flat(),
    (member, score) => {
      result.push({ member, score: tryReplyToNumber(score, commandName) });
    },
    commandName,
  );

  return result;
}

export function tryReplyToStringsOrSortedSetMembers(
  reply: unknown,
  commandName: CommandName | undefined,
  withScores: boolean | undefined,
): string[] | RespSortedSetMember[] {
  return withScores
    ? tryReplyToSortedSetMembers(reply, commandName)
    : tryReplyToStringArray(reply, commandName);
}

export function tryReplyToKeyValuePairOrNull<
  Options extends CommandBufferOptions | undefined = undefined,
>(
  reply: unknown,
  commandName?: CommandName,
  options?: Options,
): [key: string, value: RespString<Options>] | null {
  if (reply === null) {
    return null;
  }

  const [key, value] = tryReplyTuple(reply, 2, commandName);

  return [
    tryReplyToString(key, commandName),
    tryReplyToStringOrBuffer(value, commandName, options),
  ];
}

export function tryReplyToKeyMemberScoreOrNull(
  reply: unknown,
  commandName?: CommandName,
): [string, string, string] | null {
  if (reply === null) {
    return null;
  }

  const [key, member, score] = tryReplyTuple(reply, 3, commandName);

  return [
    tryReplyToString(key, commandName),
    tryReplyToString(member, commandName),
    formatDouble(tryReplyToNumber(score, commandName)),
  ];
}

export function tryReplyToCuckooFilterInsertResults(
  reply: unknown,
  commandName?: CommandName,
): (boolean | null)[] {
  return tryReplyArray(reply, commandName).map((value) =>
    value === -1 ? null : tryReplyToBoolean(value, commandName),
  );
}

export function tryReplyToJsonNumbers(
  reply: unknown,
  commandName?: CommandName,
): (number | null)[] {
  return [tryReplyToNumberScalarOrArray(reply, commandName)].flat();
}

export function tryReplyToJsonNumberText(
  reply: unknown,
  path: string,
  commandName?: CommandName,
): string {
  const values = Array.isArray(reply)
    ? reply
    : (tryReplyToString(reply, commandName).match(/[^[\],]+/g) ?? []);
  const texts = values.map((value) => {
    const text = `${value}`;

    return text === 'null' || /^-?\d+$/.test(text)
      ? text
      : formatDouble(tryReplyToNumber(text, commandName));
  });

  if (path.startsWith('$')) {
    return `[${texts.join(',')}]`;
  }

  const text = texts.filter((value) => value !== 'null').at(-1);

  if (text === undefined) {
    const message = 'ERR Path does not exist or does not contains a number';

    throw newCommandError(message, commandName, new RespError(message));
  }

  return text;
}

export function tryReplyToNumberScalarOrArray(
  reply: unknown,
  commandName?: CommandName,
): number | (number | null)[] | null {
  if (Array.isArray(reply)) {
    return tryReplyToNullableNumberArray(reply, commandName);
  }

  return tryReplyToNumberOrNull(reply, commandName);
}

export function tryReplyToStringScalarOrArray(
  reply: unknown,
  commandName?: CommandName,
): string | (string | null)[] | null {
  if (Array.isArray(reply)) {
    return tryReplyToNullableStringArray(reply, commandName);
  }

  return tryReplyToStringOrNull(reply, commandName);
}

export function tryReplyToMap(
  reply: unknown,
  commandName?: CommandName,
): Map<unknown, unknown> {
  if (reply instanceof Map) {
    return reply;
  }

  const map = new Map<unknown, unknown>();

  processPairedArray(
    reply,
    (key, value) => {
      map.set(key, value);
    },
    commandName,
  );

  return map;
}

export function tryReplyToStringOrBufferRecord<
  Options extends CommandBufferOptions | undefined,
>(
  fields: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): Record<string, RespString<Options>> {
  const result: Record<string, RespString<Options>> = {};

  processPairedArray(
    fields,
    (key, value) => {
      setRecordEntry(
        result,
        key,
        tryReplyToStringOrBuffer(value, commandName, options),
      );
    },
    commandName,
  );

  return result;
}

export function tryReplyToStringRecord(
  fields: unknown,
  commandName?: CommandName,
): Record<string, string> {
  return tryReplyToStringOrBufferRecord(fields, commandName, undefined);
}

export function tryReplyToModuleInfo(
  modules: unknown,
  commandName?: CommandName,
): RespModuleInfo {
  const moduleData = tryReplyToMap(modules, commandName);

  const name = moduleData.get('name');
  const version = moduleData.get('ver');
  const path = moduleData.get('path');
  const moduleArguments = moduleData.get('args');

  if (name === undefined || version === undefined) {
    throw newCommandError(
      `${UnexpectedReplyPrefix}: missing name or ver`,
      commandName,
    );
  }

  const result: RespModuleInfo = {
    name: tryReplyToString(name, commandName),
    version: tryReplyToNumber(version, commandName),
  };

  if (path) {
    result.path = tryReplyToString(path, commandName);
  }

  if (moduleArguments) {
    result.arguments = tryReplyToStringArray(moduleArguments, commandName);
  }

  return result;
}

export function tryReplyToGeoRadius(
  reply: unknown,
  commandName: CommandName,
  options?: CommandGeoSearchOptions | CommandGeoRadiusOptions,
): RespGeoRadius[] {
  return tryReplyArray(reply, commandName).map((item) => {
    if (isStringOrBuffer(item)) {
      return { member: tryReplyToString(item, commandName) };
    }

    const fields = tryReplyArray(item, commandName);
    const result: RespGeoRadius = {
      member: tryReplyToString(fields[0], commandName),
    };

    let currentIndex = 1;

    if (options?.withDist) {
      result.distance = tryReplyToNumber(fields[currentIndex], commandName);
      currentIndex += 1;
    }

    if (options?.withHash) {
      result.hash = tryReplyToNumber(fields[currentIndex], commandName);
      currentIndex += 1;
    }

    if (options?.withCoord) {
      const [longitude, latitude] = tryReplyArray(
        fields[currentIndex],
        commandName,
      );

      result.position = {
        longitude: tryReplyToNumber(longitude, commandName),
        latitude: tryReplyToNumber(latitude, commandName),
      };
    }

    return result;
  });
}

export function tryReplyToScan(
  reply: unknown,
  commandName?: CommandName,
): [cursor: string, elements: unknown[]] {
  const [cursor, elements] = tryReplyTuple(reply, 2, commandName);

  return [
    tryReplyToString(cursor, commandName),
    tryReplyArray(elements, commandName),
  ];
}

export function tryReplyToStreamEntry(
  entry: unknown,
  commandName?: CommandName,
): RespStreamEntry {
  const [id, fields] = tryReplyTuple(entry, 2, commandName);

  return {
    id: tryReplyToString(id, commandName),
    fields: tryReplyToStringRecord(fields, commandName),
  };
}

export function tryReplyToStreamEntryOrDeleted(
  entry: unknown,
  commandName?: CommandName,
): RespStreamEntry | RespStreamDeletedEntry {
  const [id, fields] = tryReplyTuple(entry, 2, commandName);

  return fields === null
    ? { id: tryReplyToString(id, commandName), fields }
    : tryReplyToStreamEntry(entry, commandName);
}

function tryReplyToStreams<T>(
  reply: unknown,
  commandName: CommandName | undefined,
  parseEntry: (entry: unknown, commandName?: CommandName) => T,
) {
  const streams = reply instanceof Map ? [...reply] : reply;

  return tryReplyArray(streams, commandName).map((stream) => {
    const [name, entries] = tryReplyTuple(stream, 2, commandName);

    return {
      stream: tryReplyToString(name, commandName),
      entries: tryReplyArray(entries, commandName).map((entry) =>
        parseEntry(entry, commandName),
      ),
    };
  });
}

export function tryReplyToStreamReadResults(
  reply: unknown,
  commandName?: CommandName,
): RespStreamReadResult[] {
  return tryReplyToStreams(reply, commandName, tryReplyToStreamEntry);
}

export function tryReplyToStreamReadResultsOrNull(
  reply: unknown,
  commandName?: CommandName,
): RespStreamReadResult[] | null {
  return reply === null
    ? null
    : tryReplyToStreamReadResults(reply, commandName);
}

export function tryReplyToStreamGroupReadResultsOrNull(
  reply: unknown,
  commandName?: CommandName,
): RespStreamGroupReadResult[] | null {
  return reply === null
    ? null
    : tryReplyToStreams(reply, commandName, tryReplyToStreamEntryOrDeleted);
}

export function tryReplyToStreamEntries(
  reply: unknown,
  commandName?: CommandName,
): RespStreamEntry[] {
  return tryReplyArray(reply, commandName)
    .filter((entry) => entry !== null)
    .map((entry) => tryReplyToStreamEntry(entry, commandName));
}

export function tryReplyToTimeSeriesSamples(
  reply: unknown,
  commandName?: CommandName,
): Array<{ timestamp: number; value: number }> {
  return tryReplyArray(reply, commandName).map((sample) => {
    const [timestamp, value] = tryReplyTuple(sample, 2, commandName);

    return {
      timestamp: tryReplyToNumber(timestamp, commandName),
      value: tryReplyToNumber(value, commandName),
    };
  });
}

export function tryReplyToTimeSeriesMultiRangeResults(
  reply: unknown,
  commandName?: CommandName,
): Array<{
  key: string;
  samples: Array<{ timestamp: number; value: number }>;
}> {
  const series =
    reply instanceof Map
      ? Array.from(reply, ([key, value]) => [
          key,
          ...tryReplyArray(value, commandName),
        ])
      : tryReplyArray(reply, commandName);

  return series.map((item) => {
    const fields = tryReplyArray(item, commandName);

    return {
      key: tryReplyToString(fields[0], commandName),
      samples: tryReplyToTimeSeriesSamples(fields.at(-1), commandName),
    };
  });
}

export function tryReplyToKeyElementsOrNull<T>(
  reply: unknown,
  commandName: CommandName,
  parseElements: (elements: unknown[], commandName: CommandName) => T,
): { key: string; elements: T } | null {
  if (reply === null) {
    return null;
  }

  const [key, elements] = tryReplyTuple(reply, 2, commandName);

  return {
    key: tryReplyToString(key, commandName),
    elements: parseElements(tryReplyArray(elements, commandName), commandName),
  };
}

export function tryReplyToNumberRecord(
  reply: unknown,
  commandName?: CommandName,
): Record<string, number> {
  const result: Record<string, number> = {};

  processPairedArray(
    reply,
    (key, value) => {
      setRecordEntry(result, key, tryReplyNumber(value, commandName));
    },
    commandName,
  );

  return result;
}

export function tryReplyToScanDump(
  reply: unknown,
  commandName: CommandName | undefined,
  nullable: true,
): [nextIterator: number, data: Buffer | null];
export function tryReplyToScanDump(
  reply: unknown,
  commandName?: CommandName,
  nullable?: false,
): [nextIterator: number, data: Buffer];
export function tryReplyToScanDump(
  reply: unknown,
  commandName?: CommandName,
  nullable?: boolean,
): [nextIterator: number, data: Buffer | null] {
  const [iterator, data] = tryReplyTuple(reply, 2, commandName);

  if (Buffer.isBuffer(data) || (data === null && nullable)) {
    return [tryReplyToNumber(iterator, commandName), data];
  }

  throw newUnexpectedReplyError(data, commandName);
}

export function tryReplyToKeyStringElementsOrNull<
  Options extends CommandBufferOptions | undefined = undefined,
>(
  reply: unknown,
  commandName: CommandName,
  options?: Options,
): RespLmpop<RespString<Options>> | null {
  return tryReplyToKeyElementsOrNull(reply, commandName, (elements) =>
    tryReplyToStringOrBufferArray(elements, commandName, options),
  );
}

export function tryReplyToKeySortedSetMembersOrNull(
  reply: unknown,
  commandName: CommandName,
) {
  return tryReplyToKeyElementsOrNull(
    reply,
    commandName,
    tryReplyToSortedSetMembers,
  );
}

export function tryReplyToGeoRadiusOrStoreCount(
  reply: unknown,
  commandName: CommandName,
  options?: CommandGeoRadiusOptions,
): RespGeoRadius[] | number {
  if (typeof reply === 'number') {
    return reply;
  }

  return tryReplyToGeoRadius(reply, commandName, options);
}
