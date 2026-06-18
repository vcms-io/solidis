import { RespOK, SolidisCommandError } from '../../index.ts';

import type {
  CommandGeoRadiusOptions,
  CommandGeoSearchOptions,
  RespConfigInfo,
  RespGeoRadius,
  RespModuleInfo,
  RespSortedSetMember,
  RespStreamEntry,
  RespStreamReadResult,
  SolidisData,
  SolidisRecursiveStringRecord,
  StringOrBuffer,
} from '../../index.ts';

type CommandName = string | StringOrBuffer[];

export const UnexpectedReplyPrefix = 'Unexpected reply';
export const InvalidReplyPrefix = 'Invalid reply';

export function newCommandError(message: string, prefix?: CommandName) {
  return new SolidisCommandError(
    `${prefix ? `[${Array.isArray(prefix) ? prefix.join(' ') : prefix}] ` : ''}${message}`,
  );
}

export function escapeReply(reply: SolidisData[][]): SolidisData {
  return reply[0]?.[0];
}

export function tryReplyOK(reply: unknown, commandName?: CommandName): RespOK {
  if (typeof reply === 'string' && reply === RespOK) {
    return RespOK;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
}

export function tryReplyOKOrNull(
  reply: unknown,
  commandName?: CommandName,
): RespOK | null {
  if (reply === null) {
    return null;
  }

  return tryReplyOK(reply, commandName);
}

export function tryReplyToBoolean(
  reply: unknown,
  commandName?: CommandName,
): boolean {
  if (typeof reply === 'boolean') {
    return reply;
  }

  if (typeof reply === 'number' && (reply === 0 || reply === 1)) {
    return reply === 1;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
}

export function tryReplyToBooleanArray(
  reply: unknown,
  commandName?: CommandName,
): boolean[] {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map((value) => tryReplyToBoolean(value, commandName));
}

export function tryReplyToString(
  reply: unknown,
  commandName?: CommandName,
): string {
  if (!(typeof reply === 'string' || reply instanceof Buffer)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return reply.toString();
}

function withNullReply<T>(
  parser: (reply: unknown, commandName?: CommandName) => T,
): (reply: unknown, commandName?: CommandName) => T | null {
  return (reply, commandName) => {
    if (reply === null) {
      return null;
    }

    return parser(reply, commandName);
  };
}

export const tryReplyToStringOrNull = withNullReply(tryReplyToString);

export function tryReplyToBinaryString(
  reply: unknown,
  commandName?: CommandName,
): string {
  if (reply instanceof Buffer) {
    return reply.toString('latin1');
  }

  if (typeof reply === 'string') {
    return reply;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
}

export const tryReplyToBinaryStringOrNull = withNullReply(
  tryReplyToBinaryString,
);

export function tryReplyNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'number') {
    return reply;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
}

export const tryReplyNumberOrNull = withNullReply(tryReplyNumber);

export function tryReplyToNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'number') {
    return reply;
  }

  const numberValue = Number(reply);

  if (Number.isNaN(numberValue)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return numberValue;
}

export const tryReplyToNumberOrNull = withNullReply(tryReplyToNumber);

export function processPairedArray(
  array: unknown,
  processor: (key: string, value: unknown) => void,
  commandName?: CommandName,
) {
  if (!Array.isArray(array) && !(array instanceof Map)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${array}`, commandName);
  }

  const targetArray = Array.isArray(array) ? array : Array.from(array).flat();

  if (targetArray.length % 2 !== 0) {
    throw newCommandError(
      `${InvalidReplyPrefix}: expected even-length array, got ${targetArray.length}`,
      commandName,
    );
  }

  for (let index = 0; index < targetArray.length; index += 2) {
    const key = targetArray[index];
    const value = targetArray[index + 1];

    const isBufferKey = Buffer.isBuffer(key);

    processor(isBufferKey ? key.toString() : `${key}`, value);
  }
}

export function tryReplyArray<T>(
  reply: T,
  commandName?: CommandName,
): T extends unknown[] ? T : T[] {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return reply as T extends unknown[] ? T : T[];
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
  if (!Array.isArray(reply) && !(reply instanceof Set)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return (Array.isArray(reply) ? reply : Array.from(reply)).map((item) => {
    if (nullable) {
      return tryReplyToStringOrNull(item, commandName);
    }

    return tryReplyToString(item, commandName);
  });
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
  if (!Array.isArray(reply)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map((value) => {
    if (nullable) {
      return tryReplyToNumberOrNull(value, commandName);
    }

    return tryReplyToNumber(value, commandName);
  });
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
  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  const result: RespSortedSetMember[] = [];

  processPairedArray(
    reply.flat(),
    (member, score) => {
      result.push({ member, score: tryReplyToNumber(score, commandName) });
    },
    commandName,
  );

  return result;
}

export const tryReplyToSortedSetMembersOrNull = withNullReply(
  tryReplyToSortedSetMembers,
);

export function tryReplyToStringsOrSortedSetMembers(
  reply: unknown,
  commandName: CommandName | undefined,
  withScores: boolean | undefined,
): string[] | RespSortedSetMember[] {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  if (!withScores) {
    return tryReplyToStringArray(reply, commandName);
  }

  return tryReplyToSortedSetMembers(reply, commandName);
}

export function tryReplyToKeyValuePairOrNull(
  reply: unknown,
  commandName?: CommandName,
): [string, string] | null {
  if (reply === null) {
    return null;
  }

  if (Array.isArray(reply) && reply.length === 2) {
    const [key, value] = reply;

    if (
      (typeof key === 'string' || key instanceof Buffer) &&
      (typeof value === 'string' || value instanceof Buffer)
    ) {
      return [`${key}`, `${value}`];
    }
  }

  throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
}

export function tryReplyToKeyMemberScoreOrNull(
  reply: unknown,
  commandName?: CommandName,
): [string, string, string] | null {
  if (reply === null) {
    return null;
  }

  if (Array.isArray(reply) && reply.length === 3) {
    const [key, member, score] = reply;

    if (
      (typeof key === 'string' || key instanceof Buffer) &&
      (typeof member === 'string' || member instanceof Buffer) &&
      (typeof score === 'string' ||
        typeof score === 'number' ||
        score instanceof Buffer)
    ) {
      return [`${key}`, `${member}`, `${score}`];
    }
  }

  throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
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

  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
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
      result[key] = tryReplyToString(value, commandName);
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
        result[key] = tryReplyToStringRecordRecursively(value, commandName);

        return;
      }

      if (typeof value === 'string' || value instanceof Buffer) {
        result[key] = tryReplyToString(value, commandName);
      }
    },
    commandName,
  );

  return result;
}

export function tryReplyToModuleInfo(modules: unknown): RespModuleInfo {
  const commandName = 'MODULE';

  if (!Array.isArray(modules) && !(modules instanceof Map)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${modules}`, commandName);
  }

  const moduleData = tryReplyToMap(modules);

  const name = moduleData.get('name');
  const version = moduleData.get('ver');
  const path = moduleData.get('path');
  const moduleArguments = moduleData.get('args');

  if (name === undefined || version === undefined) {
    throw newCommandError(
      `${InvalidReplyPrefix}: Missing required ${commandName} fields: ${modules}`,
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
  const map = tryReplyToMap(reply);

  for (const [key, value] of map) {
    result[`${key}`] = tryReplyToString(value, 'CONFIG');
  }

  return result;
}

export function tryReplyToGeoRadius(
  reply: unknown,
  commandName: CommandName,
  options?: CommandGeoSearchOptions | CommandGeoRadiusOptions,
): RespGeoRadius[] {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map((item) => {
    if (typeof item === 'string' || item instanceof Buffer) {
      return { member: tryReplyToString(item, commandName) };
    }

    if (!Array.isArray(item)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${item}`, commandName);
    }

    const result: RespGeoRadius = {
      member: tryReplyToString(item[0], commandName),
    };

    let currentIndex = 1;

    if (options?.withDist) {
      const distance = item[currentIndex++];

      /** RESP2 sends the distance as a bulk string, RESP3 as a native double. */
      if (
        typeof distance === 'number' ||
        typeof distance === 'string' ||
        distance instanceof Buffer
      ) {
        result.distance = Number.parseFloat(`${distance}`);
      }
    }

    if (options?.withHash) {
      const hash = item[currentIndex++];

      if (typeof hash === 'number') {
        result.hash = hash;
      } else if (typeof hash === 'string' || hash instanceof Buffer) {
        result.hash = Number.parseInt(`${hash}`, 10);
      }
    }

    if (options?.withCoord) {
      const coordinates = item[currentIndex++];

      if (Array.isArray(coordinates) && coordinates.length === 2) {
        const [longitude, latitude] = coordinates;

        /** Coordinates are bulk strings under RESP2 and native doubles under RESP3. */
        const parsedLongitude = Number.parseFloat(`${longitude}`);
        const parsedLatitude = Number.parseFloat(`${latitude}`);

        if (!Number.isNaN(parsedLongitude) && !Number.isNaN(parsedLatitude)) {
          result.position = {
            longitude: parsedLongitude,
            latitude: parsedLatitude,
          };
        }
      }
    }

    return result;
  });
}

export function tryReplyToScan(
  reply: unknown,
): [cursor: string, elements: unknown[]] {
  const commandName = 'SCAN';

  if (!Array.isArray(reply) || reply.length !== 2) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  const [cursor, elements] = reply;

  if (!Array.isArray(elements)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${elements}`, commandName);
  }

  return [tryReplyToString(cursor), elements];
}

export function tryReplyToStreamEntry(entry: unknown): RespStreamEntry {
  if (!Array.isArray(entry) || entry.length !== 2) {
    throw newCommandError(`${InvalidReplyPrefix}: ${entry}`, 'STREAM');
  }

  const [id, fields] = entry;

  return {
    id: `${id}`,
    fields: tryReplyToStringRecord(fields),
  };
}

export function tryReplyToStreamReadResults(
  reply: unknown,
  commandName?: CommandName,
): RespStreamReadResult[] {
  const streams = reply instanceof Map ? Array.from(reply.entries()) : reply;

  if (!Array.isArray(streams)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  return streams.map((stream): RespStreamReadResult => {
    if (!Array.isArray(stream) || stream.length !== 2) {
      throw newCommandError(`${InvalidReplyPrefix}: ${stream}`, commandName);
    }

    const [name, entries] = stream;

    if (!Array.isArray(entries)) {
      throw newCommandError(`${InvalidReplyPrefix}: ${entries}`, commandName);
    }

    return {
      stream: String(name),
      entries: entries.map((entry) => tryReplyToStreamEntry(entry)),
    };
  });
}

export const tryReplyToStreamReadResultsOrNull = withNullReply(
  tryReplyToStreamReadResults,
);

export function tryReplyToStreamEntries(
  reply: unknown,
  commandName?: CommandName,
): RespStreamEntry[] {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map(tryReplyToStreamEntry);
}

export function tryReplyToTimeSeriesSamples(
  reply: unknown,
  commandName?: CommandName,
): Array<{ timestamp: number; value: number }> {
  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map((sample) => {
    if (!Array.isArray(sample) || sample.length !== 2) {
      throw newCommandError(`${InvalidReplyPrefix}: ${sample}`, commandName);
    }

    const parsedTimestamp = Number(sample[0]);
    const parsedValue = Number(sample[1]);

    if (Number.isNaN(parsedTimestamp) || Number.isNaN(parsedValue)) {
      throw newCommandError(
        `${InvalidReplyPrefix}: ${sample[0]}/${sample[1]}`,
        commandName,
      );
    }

    return { timestamp: parsedTimestamp, value: parsedValue };
  });
}

export function tryReplyToTimeSeriesMultiRangeResults(
  reply: unknown,
  commandName?: CommandName,
): Array<{
  key: string;
  samples: Array<{ timestamp: number; value: number }>;
}> {
  if (reply instanceof Map) {
    const results: Array<{
      key: string;
      samples: Array<{ timestamp: number; value: number }>;
    }> = [];

    for (const [key, value] of reply) {
      if (!Array.isArray(value)) {
        throw newCommandError(`${InvalidReplyPrefix}: ${value}`, commandName);
      }

      const samples = value[value.length - 1];

      if (!Array.isArray(samples)) {
        throw newCommandError(`${InvalidReplyPrefix}: ${samples}`, commandName);
      }

      results.push({
        key: `${key}`,
        samples: tryReplyToTimeSeriesSamples(samples, commandName),
      });
    }

    return results;
  }

  if (!Array.isArray(reply)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  return reply.map((item) => {
    if (!Array.isArray(item) || item.length < 2) {
      throw newCommandError(`${InvalidReplyPrefix}: ${item}`, commandName);
    }

    const key = item[0];
    const samples = item[item.length - 1];

    if (typeof key !== 'string' && !(key instanceof Buffer)) {
      throw newCommandError(`${InvalidReplyPrefix}: ${key}`, commandName);
    }

    if (!Array.isArray(samples)) {
      throw newCommandError(`${InvalidReplyPrefix}: ${samples}`, commandName);
    }

    return {
      key: `${key}`,
      samples: tryReplyToTimeSeriesSamples(samples, commandName),
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

  if (!Array.isArray(reply) || reply.length !== 2) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
  }

  const [key, elements] = reply;

  if (!(typeof key === 'string' || key instanceof Buffer)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${key}`, commandName);
  }

  if (!Array.isArray(elements)) {
    throw newCommandError(`${UnexpectedReplyPrefix}: ${elements}`, commandName);
  }

  return {
    key: `${key}`,
    elements: parseElements(elements, commandName),
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
      result[key] = tryReplyNumber(value, commandName);
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
  if (Array.isArray(reply) && reply.length === 2) {
    const [nextIterator, data] = reply;

    if (data === null) {
      if (nullable) {
        return [Number(nextIterator), null];
      }

      throw newCommandError(`${InvalidReplyPrefix}: ${data}`, commandName);
    }

    if (data instanceof Buffer) {
      return [Number(nextIterator), data];
    }

    throw newCommandError(`${InvalidReplyPrefix}: ${data}`, commandName);
  }

  throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, commandName);
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
