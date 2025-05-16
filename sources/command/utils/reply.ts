import { RespOK, SolidisCommandError } from '../../index.ts';

import type {
  CommandGeoRadiusOptions,
  CommandGeoSearchOptions,
  RespConfigInfo,
  RespGeoRadius,
  RespModuleInfo,
  RespStreamEntry,
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
  return reply[0][0];
}

export function tryReplyOK(reply: unknown, commandName?: CommandName): RespOK {
  if (typeof reply === 'string' && reply === RespOK) {
    return RespOK;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
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

export function tryReplyToString(
  reply: unknown,
  commandName?: CommandName,
): string {
  if (!(typeof reply === 'string' || reply instanceof Buffer)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
  }

  return reply.toString();
}

export function tryReplyToStringOrNull(
  reply: unknown,
  commandName?: CommandName,
): string | null {
  if (reply === null) {
    return null;
  }

  return tryReplyToString(reply, commandName);
}

export function tryReplyNumber(
  reply: unknown,
  commandName?: CommandName,
): number {
  if (typeof reply === 'number') {
    return reply;
  }

  throw newCommandError(`${InvalidReplyPrefix}: ${reply}`, commandName);
}

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

export function tryReplyToNumberOrNull(
  reply: unknown,
  commandName?: CommandName,
): number | null {
  if (reply === null) {
    return null;
  }

  return tryReplyToNumber(reply, commandName);
}

export function processPairedArray(
  array: unknown,
  processor: (key: string, value: unknown) => void,
  commandName?: CommandName,
) {
  if (!Array.isArray(array) && !(array instanceof Map)) {
    throw newCommandError(`${InvalidReplyPrefix}: ${array}`, commandName);
  }

  const targetArray = Array.isArray(array) ? array : Array.from(array).flat();

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
  const ver = moduleData.get('ver');
  const path = moduleData.get('path');
  const args = moduleData.get('args');

  if (name === undefined || ver === undefined) {
    throw newCommandError(
      `${InvalidReplyPrefix}: Missing required ${commandName} fields: ${modules}`,
      commandName,
    );
  }

  const result: RespModuleInfo = {
    name: tryReplyToString(name, commandName),
    version: tryReplyToNumber(ver, commandName),
  };

  if (path) {
    result.path = tryReplyToString(path, commandName);
  }

  if (args) {
    result.arguments = tryReplyToStringArray(args, commandName);
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
  reply: unknown[],
  commandName: string,
  options?: CommandGeoSearchOptions | CommandGeoRadiusOptions,
): RespGeoRadius[] {
  return reply.map((item) => {
    if (!Array.isArray(item)) {
      throw newCommandError(`${UnexpectedReplyPrefix}: ${item}`, commandName);
    }

    const result: RespGeoRadius = {
      member: '',
    };

    const memberIndex = 0;
    let currentIndex = 0;

    if (options?.withDist) {
      const dist = item[currentIndex++];

      if (typeof dist === 'string' || dist instanceof Buffer) {
        result.distance = Number.parseFloat(`${dist}`);
      }
    }

    if (options?.withHash) {
      const hash = item[currentIndex++];

      if (typeof hash === 'string' || hash instanceof Buffer) {
        result.hash = Number.parseInt(`${hash}`, 10);
      }
    }

    if (options?.withCoord) {
      const coords = item[currentIndex++];

      if (Array.isArray(coords) && coords.length === 2) {
        const [longitude, latitude] = coords;
        if (
          (typeof longitude === 'string' || longitude instanceof Buffer) &&
          (typeof latitude === 'string' || latitude instanceof Buffer)
        ) {
          const lon = Number.parseFloat(`${longitude}`);
          const lat = Number.parseFloat(`${latitude}`);

          if (!Number.isNaN(lon) && !Number.isNaN(lat)) {
            result.position = { longitude: lon, latitude: lat };
          }
        }
      }
    }

    const member = item[memberIndex];

    result.member = tryReplyToString(member, commandName);

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
