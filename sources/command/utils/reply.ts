import { RespError, SolidisCommandError } from '../../common/utils/error.ts';
import { formatDouble, parseDouble } from '../../common/utils/number.ts';
import { getCommandName } from '../../common/utils/request.ts';
import { RespOK } from '../../types/resp.ts';

import type {
  CommandGeoRadiusOptions,
  CommandGeoSearchOptions,
  CommandIntegerOptions,
} from '../../types/command.ts';
import type {
  RespConfigInfo,
  RespGeoRadius,
  RespInteger,
  RespModuleInfo,
  RespSortedSetMember,
  RespStreamDeletedEntry,
  RespStreamEntry,
  RespStreamGroupReadResult,
  RespStreamReadResult,
} from '../../types/resp.ts';
import type {
  SolidisData,
  SolidisRecursiveStringRecord,
  StringOrBuffer,
} from '../../types/solidis.ts';

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
  if (commandName === undefined) {
    return new SolidisCommandError(message, cause);
  }

  const name =
    typeof commandName === 'string' ? commandName : getCommandName(commandName);

  return new SolidisCommandError(`[${name}] ${message}`, cause);
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

export function escapeReply(reply: SolidisData[][]): SolidisData {
  return reply[0]?.[0];
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
  if (typeof reply === 'string') {
    return reply;
  }

  if (Buffer.isBuffer(reply)) {
    return reply.toString();
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyToStringOrNull(
  reply: unknown,
  commandName?: CommandName,
): string | null {
  return reply === null ? null : tryReplyToString(reply, commandName);
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

export function tryReplyToInteger<
  Options extends CommandIntegerOptions | undefined,
>(
  reply: unknown,
  commandName: CommandName | undefined,
  options: Options | undefined,
): RespInteger<Options> {
  if (options?.bigint !== true) {
    return tryReplyNumber(reply, commandName) as RespInteger<Options>;
  }

  return (
    typeof reply === 'bigint'
      ? reply
      : BigInt(tryReplyNumber(reply, commandName))
  ) as RespInteger<Options>;
}

export function tryReplyToNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'number') {
    return reply;
  }

  if (typeof reply === 'boolean') {
    return reply ? 1 : 0;
  }

  if (typeof reply === 'bigint') {
    return tryReplyNumber(reply, commandName);
  }

  const value =
    typeof reply === 'string' || Buffer.isBuffer(reply)
      ? parseDouble(reply.toString())
      : undefined;

  if (value === undefined) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return value;
}

export function tryReplyToNumberOrNull(
  reply: unknown,
  commandName?: CommandName,
): number | null {
  return reply === null ? null : tryReplyToNumber(reply, commandName);
}

export function tryReplyToDoubleString(
  reply: unknown,
  commandName?: CommandName,
): string {
  if (typeof reply === 'number') {
    return formatDouble(reply);
  }

  return tryReplyToString(reply, commandName);
}

export function processPairedArray(
  array: unknown,
  processor: (key: string, value: unknown) => void,
  commandName?: CommandName,
) {
  if (!Array.isArray(array) && !(array instanceof Map)) {
    throw newUnexpectedReplyError(array, commandName);
  }

  const targetArray = Array.isArray(array) ? array : Array.from(array).flat();

  if (targetArray.length % 2 !== 0) {
    throw newCommandError(
      `${UnexpectedReplyPrefix}: expected even-length array, got ${targetArray.length}`,
      commandName,
    );
  }

  for (let index = 0; index < targetArray.length; index += 2) {
    const key = targetArray[index];
    const value = targetArray[index + 1];

    processor(Buffer.isBuffer(key) ? key.toString() : `${key}`, value);
  }
}

export function tryReplyArray(
  reply: unknown,
  commandName?: CommandName,
): unknown[] {
  if (Array.isArray(reply)) {
    return reply;
  }

  if (reply instanceof Set) {
    return Array.from(reply);
  }

  throw newUnexpectedReplyError(reply, commandName);
}

export function tryReplyToStringArray(
  reply: unknown,
  commandName: CommandName | undefined,
  nullable: true,
): (string | null)[];
export function tryReplyToStringArray(
  reply: unknown,
  commandName: CommandName | undefined,
  nullable: false,
): string[];
export function tryReplyToStringArray(
  reply: unknown,
  commandName?: CommandName,
): string[];
export function tryReplyToStringArray(
  reply: unknown,
  commandName?: CommandName,
  nullable = false,
): string[] | (string | null)[] {
  return tryReplyArray(reply, commandName).map((item) =>
    nullable
      ? tryReplyToStringOrNull(item, commandName)
      : tryReplyToString(item, commandName),
  );
}

export function tryReplyToNullableStringArray(
  reply: unknown,
  commandName?: CommandName,
): (string | null)[] {
  return tryReplyToStringArray(reply, commandName, true);
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
  reply: unknown,
  commandName?: CommandName,
): (number | RespError)[] {
  return tryReplyArray(reply, commandName).map((item) =>
    item instanceof RespError ? item : tryReplyToNumber(item, commandName),
  );
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

export function tryReplyToSortedSetMembersOrNull(
  reply: unknown,
  commandName?: CommandName,
): RespSortedSetMember[] | null {
  return reply === null ? null : tryReplyToSortedSetMembers(reply, commandName);
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

export function tryReplyToKeyValuePairOrNull(
  reply: unknown,
  commandName?: CommandName,
): [string, string] | null {
  if (reply === null) {
    return null;
  }

  const pair = tryReplyArray(reply, commandName);

  if (pair.length !== 2) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return [
    tryReplyToString(pair[0], commandName),
    tryReplyToString(pair[1], commandName),
  ];
}

export function tryReplyToKeyMemberScoreOrNull(
  reply: unknown,
  commandName?: CommandName,
): [string, string, string] | null {
  if (reply === null) {
    return null;
  }

  const triple = tryReplyArray(reply, commandName);

  if (triple.length !== 3) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return [
    tryReplyToString(triple[0], commandName),
    tryReplyToString(triple[1], commandName),
    tryReplyToDoubleString(triple[2], commandName),
  ];
}

export function tryReplyToCuckooFilterInsertResults(
  reply: unknown,
  commandName?: CommandName,
): boolean[] {
  return tryReplyArray(reply, commandName).map((value) =>
    value === -1 ? false : tryReplyToBoolean(value, commandName),
  );
}

export function tryReplyToJsonNumbers(
  reply: unknown,
  commandName?: CommandName,
): (number | null)[] {
  if (Array.isArray(reply)) {
    return tryReplyToNullableNumberArray(reply, commandName);
  }

  return [tryReplyToNumberOrNull(reply, commandName)];
}

export function tryReplyToJsonNumberText(
  reply: unknown,
  path: string,
  commandName?: CommandName,
): string | null {
  if (reply === null) {
    return null;
  }

  if (!Array.isArray(reply)) {
    return tryReplyToString(reply, commandName);
  }

  const values = tryReplyToNullableNumberArray(reply, commandName);

  if (!path.startsWith('$') && values.length === 1) {
    return `${values[0]}`;
  }

  return JSON.stringify(values);
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

export function tryReplyToStringRecord(
  fields: unknown,
  commandName?: CommandName,
): Record<string, string> {
  const result: Record<string, string> = {};

  processPairedArray(
    fields,
    (key, value) => {
      setRecordEntry(result, key, tryReplyToString(value, commandName));
    },
    commandName,
  );

  return result;
}

export function tryReplyToStringRecordRecursively(
  reply: unknown,
  commandName?: CommandName,
) {
  const result: SolidisRecursiveStringRecord = {};

  processPairedArray(
    reply,
    (key, value) => {
      if (Array.isArray(value) || value instanceof Map) {
        setRecordEntry(
          result,
          key,
          tryReplyToStringRecordRecursively(value, commandName),
        );
      } else if (typeof value === 'string' || Buffer.isBuffer(value)) {
        setRecordEntry(result, key, tryReplyToString(value, commandName));
      }
    },
    commandName,
  );

  return result;
}

export function tryReplyToModuleInfo(modules: unknown): RespModuleInfo {
  const commandName = 'MODULE';
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

export function tryReplyToConfigInfo(reply: unknown): RespConfigInfo {
  const result: RespConfigInfo = {};

  for (const [key, value] of tryReplyToMap(reply, 'CONFIG')) {
    setRecordEntry(result, `${key}`, tryReplyToString(value, 'CONFIG'));
  }

  return result;
}

export function tryReplyToGeoRadius(
  reply: unknown,
  commandName: CommandName,
  options?: CommandGeoSearchOptions | CommandGeoRadiusOptions,
): RespGeoRadius[] {
  return tryReplyArray(reply, commandName).map((item) => {
    if (typeof item === 'string' || Buffer.isBuffer(item)) {
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
  const scan = tryReplyArray(reply, commandName);

  if (scan.length !== 2) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return [
    tryReplyToString(scan[0], commandName),
    tryReplyArray(scan[1], commandName),
  ];
}

function tryReplyToStreamPair(entry: unknown, commandName?: CommandName) {
  const pair = tryReplyArray(entry, commandName);

  if (pair.length !== 2) {
    throw newUnexpectedReplyError(entry, commandName);
  }

  return pair;
}

export function tryReplyToStreamEntry(
  entry: unknown,
  commandName?: CommandName,
): RespStreamEntry {
  const [id, fields] = tryReplyToStreamPair(entry, commandName);

  return {
    id: tryReplyToString(id, commandName),
    fields: tryReplyToStringRecord(fields, commandName),
  };
}

export function tryReplyToStreamEntryOrDeleted(
  entry: unknown,
  commandName?: CommandName,
): RespStreamEntry | RespStreamDeletedEntry {
  const [id, fields] = tryReplyToStreamPair(entry, commandName);

  if (fields === null) {
    return { id: tryReplyToString(id, commandName), fields };
  }

  return {
    id: tryReplyToString(id, commandName),
    fields: tryReplyToStringRecord(fields, commandName),
  };
}

function tryReplyToStreams<T>(
  reply: unknown,
  commandName: CommandName | undefined,
  parseEntry: (entry: unknown, commandName?: CommandName) => T,
) {
  const streams = reply instanceof Map ? Array.from(reply.entries()) : reply;

  return tryReplyArray(streams, commandName).map((stream) => {
    const [name, entries] = tryReplyToStreamPair(stream, commandName);

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
  return tryReplyArray(reply, commandName).map((entry) =>
    tryReplyToStreamEntry(entry, commandName),
  );
}

export function tryReplyToTimeSeriesSamples(
  reply: unknown,
  commandName?: CommandName,
): Array<{ timestamp: number; value: number }> {
  return tryReplyArray(reply, commandName).map((sample) => {
    const pair = tryReplyArray(sample, commandName);

    if (pair.length !== 2) {
      throw newUnexpectedReplyError(sample, commandName);
    }

    return {
      timestamp: tryReplyToNumber(pair[0], commandName),
      value: tryReplyToNumber(pair[1], commandName),
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

    if (fields.length < 2) {
      throw newUnexpectedReplyError(item, commandName);
    }

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

  const pair = tryReplyArray(reply, commandName);

  if (pair.length !== 2) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  return {
    key: tryReplyToString(pair[0], commandName),
    elements: parseElements(tryReplyArray(pair[1], commandName), commandName),
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
  const pair = tryReplyArray(reply, commandName);
  const data = pair[1];

  if (pair.length !== 2) {
    throw newUnexpectedReplyError(reply, commandName);
  }

  if (Buffer.isBuffer(data) || (data === null && nullable)) {
    return [tryReplyToNumber(pair[0], commandName), data];
  }

  throw newUnexpectedReplyError(data, commandName);
}

export function tryReplyToKeyStringElementsOrNull(
  reply: unknown,
  commandName: CommandName,
) {
  return tryReplyToKeyElementsOrNull(reply, commandName, tryReplyToStringArray);
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
