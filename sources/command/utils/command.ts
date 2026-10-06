import { formatInteger } from '../../common/utils/internal.ts';
import { toCommandError } from '../../common/utils/request.ts';
import {
  newCommandError,
  tryReplyNumber,
  tryReplyOK,
  tryReplyToInteger,
  tryReplyToScan,
  tryReplyToString,
  tryReplyToStringArray,
  tryReplyToStringOrBufferArray,
  tryReplyToStringOrBufferOrNull,
  tryReplyToStringOrNull,
} from './reply.ts';

import type { SolidisClient } from '../../client.ts';
import type {
  CommandBufferOptions,
  CommandCuckooFilterInsertOptions,
  CommandExpireMode,
  CommandGeoRadiusOptions,
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchOptions,
  CommandIntegerOptions,
  CommandKeyExpireMode,
  CommandScanOptions,
  CommandSetOptions,
  CommandSortOptions,
  CommandTimeSeriesOptions,
  CommandTimeSeriesRangeOptions,
  CommandZInterOptions,
  CommandZRangeOptions,
  CommandZRangeStoreOptions,
} from '../../types/command.ts';
import type { RespInteger, RespOK, RespString } from '../../types/resp.ts';
import type {
  SolidisData,
  SolidisSendOptions,
  StringOrBuffer,
} from '../../types/solidis.ts';

export function assertSender(
  client: unknown,
  command?: StringOrBuffer[],
): asserts client is Pick<SolidisClient, 'send'> {
  if (typeof Object(client).send !== 'function') {
    throw newCommandError('Send method is not implemented', command);
  }
}

export function guard(
  client: unknown,
  command?: StringOrBuffer[],
): client is Pick<SolidisClient, 'send'> {
  assertSender(client, command);

  return true;
}

export async function executeCommand<T>(
  client: T,
  command: StringOrBuffer[],
): Promise<SolidisData>;
export async function executeCommand<T, R>(
  client: T,
  command: StringOrBuffer[],
  replyTo: (reply: SolidisData, command: StringOrBuffer[]) => R,
  options?: undefined,
  sendOptions?: SolidisSendOptions,
): Promise<R>;
export async function executeCommand<T, R, Options extends object | undefined>(
  client: T,
  command: StringOrBuffer[],
  replyTo: (
    reply: SolidisData,
    command: StringOrBuffer[],
    options: Options,
  ) => R,
  options: Options,
  sendOptions?: SolidisSendOptions,
): Promise<R>;
export async function executeCommand<T, R>(
  client: T,
  command: StringOrBuffer[],
  replyTo?: (
    reply: SolidisData,
    command: StringOrBuffer[],
    options?: CommandBufferOptions & CommandIntegerOptions,
  ) => R,
  options?: CommandBufferOptions & CommandIntegerOptions,
  sendOptions?: SolidisSendOptions,
): Promise<R | SolidisData> {
  assertSender(client, command);

  const replyOptions = options && {
    ...options,
    buffer: options.buffer,
    bigint: options.bigint,
  };
  const reply = (await client.send([command], sendOptions))[0]?.[0];

  if (reply instanceof Error) {
    throw toCommandError(reply, command);
  }

  return replyTo ? replyTo(reply, command, replyOptions) : reply;
}

export function appendRecordEntries(
  command: StringOrBuffer[],
  record: Record<string, StringOrBuffer>,
) {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw newCommandError('Expected an object of names and values', command);
  }

  for (const [name, value] of Object.entries(record)) {
    command.push(name, value);
  }

  return command;
}

export function buildCuckooFilterInsertCommand(
  command: string,
  key: string,
  items: string[],
  options?: CommandCuckooFilterInsertOptions,
) {
  const result = [command, key];

  if (options) {
    if (options.capacity !== undefined) {
      result.push('CAPACITY', formatInteger(options.capacity));
    }

    if (options.nocreate === true) {
      result.push('NOCREATE');
    }
  }

  return [...result, 'ITEMS', ...items];
}

function appendGeoResultOptions(
  command: string[],
  options?: CommandGeoSearchOptions,
) {
  if (options?.withCoord) {
    command.push('WITHCOORD');
  }

  if (options?.withDist) {
    command.push('WITHDIST');
  }

  if (options?.withHash) {
    command.push('WITHHASH');
  }

  if (options?.count !== undefined) {
    command.push('COUNT', formatInteger(options.count));
    if (options.any) {
      command.push('ANY');
    }
  }

  if (options?.asc) {
    command.push('ASC');
  } else if (options?.desc) {
    command.push('DESC');
  }
}

export function buildGeoRadiusCommand(
  baseCommand: string[],
  options?: CommandGeoRadiusOptions,
) {
  const command = [...baseCommand];

  appendGeoResultOptions(command, options);

  if (options?.store !== undefined) {
    command.push('STORE', options.store);
  }

  if (options?.storedist !== undefined) {
    command.push('STOREDIST', options.storedist);
  }

  return command;
}

export function buildGeoSearchCommand(
  baseCommand: string[],
  from: CommandGeoSearchFromOptions,
  by: CommandGeoSearchByOptions,
  options?: CommandGeoSearchOptions,
) {
  const command = [...baseCommand];

  if (from.frommember !== undefined) {
    command.push('FROMMEMBER', from.frommember);
  } else if (from.fromlonlat) {
    command.push(
      'FROMLONLAT',
      `${from.fromlonlat.longitude}`,
      `${from.fromlonlat.latitude}`,
    );
  }

  if (by.bybox) {
    command.push(
      'BYBOX',
      `${by.bybox.width}`,
      `${by.bybox.height}`,
      by.bybox.unit.toLowerCase(),
    );
  } else if (by.byradius) {
    command.push(
      'BYRADIUS',
      `${by.byradius.radius}`,
      by.byradius.unit.toLowerCase(),
    );
  }

  appendGeoResultOptions(command, options);

  return command;
}

export function buildSetCommand(
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
) {
  const command = ['SET', key, value];

  if (options) {
    appendExpireOptions(command, options);

    if (options.keepOriginalTimeToLive === true) {
      command.push('KEEPTTL');
    }

    if (options.setIfKeyNotExists === true) {
      command.push('NX');
    }

    if (options.setIfKeyExists === true) {
      command.push('XX');
    }

    appendValueConditionOptions(
      command,
      options.setIfValueEquals,
      options.setIfValueNotEquals,
      options.setIfDigestEquals,
      options.setIfDigestNotEquals,
    );

    if (options.returnOldValue === true) {
      command.push('GET');
    }
  }

  return command;
}

export function buildScanCommand(
  baseCommand: string[],
  cursor: string,
  options: CommandScanOptions,
) {
  const command = [...baseCommand, cursor];

  if (options.count !== undefined) {
    command.push('COUNT', formatInteger(options.count));
  }

  if (options.match !== undefined) {
    command.push('MATCH', options.match);
  }

  if (options.type !== undefined) {
    command.push('TYPE', options.type);
  }

  return command;
}

export function buildTimeSeriesCommand<
  T extends CommandTimeSeriesOptions = CommandTimeSeriesOptions,
>(baseCommand: string[], options: T) {
  const command = [...baseCommand];

  if (options.retention !== undefined) {
    command.push('RETENTION', formatInteger(options.retention));
  }

  if (options.encoding) {
    command.push('ENCODING', options.encoding);
  }

  if (options.chunkSize !== undefined) {
    command.push('CHUNK_SIZE', formatInteger(options.chunkSize));
  }

  if (options.duplicatePolicy) {
    command.push('DUPLICATE_POLICY', options.duplicatePolicy);
  }

  if (options.onDuplicate) {
    command.push('ON_DUPLICATE', options.onDuplicate);
  }

  if (options.ignore) {
    command.push(
      'IGNORE',
      formatInteger(options.ignore.maxTimediff),
      `${options.ignore.maxValDiff}`,
    );
  }

  if (options.labels) {
    command.push('LABELS');
    appendRecordEntries(command, options.labels);
  }

  return command;
}

export function buildTimeSeriesRangeCommand(
  baseCommand: string[],
  options: CommandTimeSeriesRangeOptions,
) {
  const command = [...baseCommand];

  if (options.filterByTs) {
    command.push('FILTER_BY_TS');

    for (const timestamp of options.filterByTs) {
      command.push(formatInteger(timestamp));
    }
  }

  if (options.filterByValue) {
    const [minimum, maximum] = options.filterByValue;

    command.push('FILTER_BY_VALUE', `${minimum}`, `${maximum}`);
  }

  if (options.count !== undefined) {
    command.push('COUNT', formatInteger(options.count));
  }

  if (options.align !== undefined) {
    command.push('ALIGN', formatInteger(options.align));
  }

  if (options.aggregation) {
    command.push(
      'AGGREGATION',
      options.aggregation.type,
      formatInteger(options.aggregation.bucketDuration),
    );
  }

  if (options.latest) {
    command.push('LATEST');
  }

  return command;
}

export function buildSortedSetInterCommand(
  baseCommand: string[],
  keys: string[],
  options: CommandZInterOptions,
) {
  const command = [...baseCommand, `${keys.length}`, ...keys];

  if (options.weights !== undefined) {
    command.push('WEIGHTS');

    for (const weight of options.weights) {
      command.push(`${weight}`);
    }
  }

  if (options.aggregate) {
    command.push('AGGREGATE', options.aggregate);
  }

  return command;
}

export function buildSortedSetRangeStoreCommand(
  baseCommand: string[],
  options: CommandZRangeStoreOptions,
) {
  const command = [...baseCommand];

  if (options.byScore) {
    command.push('BYSCORE');
  }

  if (options.byLex) {
    command.push('BYLEX');
  }

  if (options.reverse) {
    command.push('REV');
  }

  if (options.limit) {
    command.push(
      'LIMIT',
      formatInteger(options.limit.offset),
      formatInteger(options.limit.count),
    );
  }

  return command;
}

export function buildSortedSetRangeCommand(
  baseCommand: string[],
  options: CommandZRangeOptions,
) {
  const command = buildSortedSetRangeStoreCommand(baseCommand, options);

  if (options.withScores) {
    command.push('WITHSCORES');
  }

  return command;
}

export function buildHelpExecutor(group: string) {
  return async function <T>(this: T): Promise<string[]> {
    return await executeCommand(this, [group, 'HELP'], tryReplyToStringArray);
  };
}

export function buildPubSubExecutor(commandName: string) {
  return async function <T>(this: T, ...channels: string[]): Promise<void> {
    await executeCommand(this, [commandName, ...channels]);
  };
}

export async function executeIntegerCommand<
  T,
  Options extends CommandIntegerOptions | undefined,
>(
  client: T,
  command: StringOrBuffer[],
  options: Options | undefined,
): Promise<RespInteger<Options>> {
  return await executeCommand(client, command, tryReplyToInteger, options);
}

export function buildKeyIntegerExecutor(commandName: string) {
  return async function <
    T,
    Options extends CommandIntegerOptions | undefined = undefined,
  >(this: T, key: string, options?: Options): Promise<RespInteger<Options>> {
    return await executeIntegerCommand(this, [commandName, key], options);
  };
}

export function buildKeyNumberExecutor(...commandParts: string[]) {
  return async function <T>(this: T, key: string): Promise<number> {
    return await executeCommand(this, [...commandParts, key], tryReplyNumber);
  };
}

export function buildWithoutArgumentsNumberExecutor(...commandParts: string[]) {
  return async function <T>(this: T): Promise<number> {
    return await executeCommand(this, commandParts, tryReplyNumber);
  };
}

export function buildKeyStringOrNullExecutor(...commandParts: string[]) {
  return async function <T>(this: T, key: string): Promise<string | null> {
    return await executeCommand(
      this,
      [...commandParts, key],
      tryReplyToStringOrNull,
    );
  };
}

export function buildKeyStringOrBufferExecutor(commandName: string) {
  return async function <
    T,
    Options extends CommandBufferOptions | undefined = undefined,
  >(
    this: T,
    key: string,
    options?: Options,
  ): Promise<RespString<Options> | null> {
    return await executeCommand(
      this,
      [commandName, key],
      tryReplyToStringOrBufferOrNull,
      options,
    );
  };
}

export function buildKeyPopExecutor(commandName: string) {
  async function pop<
    T,
    Options extends CommandBufferOptions | undefined = undefined,
  >(
    this: T,
    key: string,
    count?: undefined,
    options?: Options,
  ): Promise<RespString<Options> | null>;
  async function pop<
    T,
    Options extends CommandBufferOptions | undefined = undefined,
  >(
    this: T,
    key: string,
    count: number,
    options?: Options,
  ): Promise<RespString<Options>[] | null>;
  async function pop<T, Options extends CommandBufferOptions | undefined>(
    this: T,
    key: string,
    count?: number,
    options?: Options,
  ): Promise<RespString<Options> | RespString<Options>[] | null>;
  async function pop<T, Options extends CommandBufferOptions | undefined>(
    this: T,
    key: string,
    count?: number,
    options?: Options,
  ): Promise<RespString<Options> | RespString<Options>[] | null> {
    const command = [commandName, key];

    if (count !== undefined) {
      command.push(formatInteger(count));
    }

    return await executeCommand(
      this,
      command,
      (reply, commandName, replyOptions) => {
        if (count === undefined || reply === null) {
          return tryReplyToStringOrBufferOrNull(
            reply,
            commandName,
            replyOptions,
          );
        }

        return tryReplyToStringOrBufferArray(reply, commandName, replyOptions);
      },
      options,
    );
  }

  return pop;
}

export function buildKeysNumberExecutor(...commandParts: string[]) {
  return async function <T>(this: T, ...keys: string[]): Promise<number> {
    return await executeCommand(
      this,
      [...commandParts, ...keys],
      tryReplyNumber,
    );
  };
}

export function buildWithoutArgumentsOKExecutor(...commandParts: string[]) {
  return async function <T>(this: T): Promise<RespOK> {
    return await executeCommand(this, commandParts, tryReplyOK);
  };
}

export function buildWithoutArgumentsStringExecutor(...commandParts: string[]) {
  return async function <T>(this: T): Promise<string> {
    return await executeCommand(this, commandParts, tryReplyToString);
  };
}

export function buildWithoutArgumentsStringOrNullExecutor(
  ...commandParts: string[]
) {
  return async function <T>(this: T): Promise<string | null> {
    return await executeCommand(this, commandParts, tryReplyToStringOrNull);
  };
}

export function buildWithoutArgumentsStringArrayExecutor(
  ...commandParts: string[]
) {
  return async function <T>(this: T): Promise<string[]> {
    return await executeCommand(this, commandParts, tryReplyToStringArray);
  };
}

export function buildKeyStringArrayExecutor(...commandParts: string[]) {
  return async function <T>(this: T, key: string): Promise<string[]> {
    return await executeCommand(
      this,
      [...commandParts, key],
      tryReplyToStringArray,
    );
  };
}

export function buildHashFieldsCommand(
  commandName: string,
  key: string,
  fields: string[],
) {
  return [commandName, key, 'FIELDS', `${fields.length}`, ...fields];
}

export function buildHashFieldExpireCommand(
  commandName: string,
  key: string,
  value: number,
  fields: string[],
  mode?: CommandExpireMode,
) {
  const command = [commandName, key, formatInteger(value)];

  if (mode) {
    command.push(mode);
  }

  return [...command, 'FIELDS', `${fields.length}`, ...fields];
}

export function buildKeyExpireCommand(commandName: string) {
  return (key: string, time: number, mode?: CommandKeyExpireMode) => {
    const command = [commandName, key, formatInteger(time)];

    if (mode) {
      command.push(...mode.split(' '));
    }

    return command;
  };
}

export function buildScriptCommand(
  commandName: string,
  scriptOrName: string,
  keys: string[],
  parameters: string[],
) {
  return [commandName, scriptOrName, `${keys.length}`, ...keys, ...parameters];
}

export function buildSortCommand(
  commandName: string,
  key: string,
  options?: Omit<CommandSortOptions, 'store'>,
) {
  const command = [commandName, key];

  if (options) {
    if (options.by !== undefined) {
      command.push('BY', options.by);
    }

    if (options.limit) {
      command.push(
        'LIMIT',
        formatInteger(options.limit.offset),
        formatInteger(options.limit.count),
      );
    }

    if (options.get) {
      for (const pattern of options.get) {
        command.push('GET', pattern);
      }
    }

    if (options.order) {
      command.push(options.order);
    }

    if (options.alpha) {
      command.push('ALPHA');
    }
  }

  return command;
}

export function buildJsonKeyPathCommand(
  commandName: string,
  key: string,
  path?: string,
) {
  const command = [commandName, key];

  if (path !== undefined) {
    command.push(path);
  }

  return command;
}

export function appendExpireOptions(
  command: StringOrBuffer[],
  options: {
    expireInSeconds?: number;
    expireInMilliseconds?: number;
    expireAtSeconds?: number;
    expireAtMilliseconds?: number;
  },
) {
  if (options.expireInSeconds !== undefined) {
    command.push('EX', formatInteger(options.expireInSeconds));
  }

  if (options.expireInMilliseconds !== undefined) {
    command.push('PX', formatInteger(options.expireInMilliseconds));
  }

  if (options.expireAtSeconds !== undefined) {
    command.push('EXAT', formatInteger(options.expireAtSeconds));
  }

  if (options.expireAtMilliseconds !== undefined) {
    command.push('PXAT', formatInteger(options.expireAtMilliseconds));
  }
}

export function appendValueConditionOptions(
  command: StringOrBuffer[],
  valueEquals?: StringOrBuffer,
  valueNotEquals?: StringOrBuffer,
  digestEquals?: string,
  digestNotEquals?: string,
) {
  if (valueEquals !== undefined) {
    command.push('IFEQ', valueEquals);
  }

  if (valueNotEquals !== undefined) {
    command.push('IFNE', valueNotEquals);
  }

  for (const [keyword, digest] of [
    ['IFDEQ', digestEquals],
    ['IFDNE', digestNotEquals],
  ] as const) {
    if (digest !== undefined) {
      if (!/^[\da-f]{16}$/i.test(digest)) {
        throw newCommandError('Digests must be 16 hexadecimal digits', command);
      }

      command.push(keyword, digest);
    }
  }
}

export function createScanIterator<T, R>(
  client: T,
  baseCommand: string[],
  { count, match, type }: CommandScanOptions,
  parseElements: (elements: unknown, commandName: StringOrBuffer[]) => R,
): AsyncGenerator<R> {
  const options = { count, match, type };

  return (async function* () {
    let cursor = '0';

    do {
      const command = buildScanCommand(baseCommand, cursor, options);
      const reply = await executeCommand(client, command);
      const [newCursor, elements] = tryReplyToScan(reply, command);

      cursor = newCursor;

      yield parseElements(elements, command);
    } while (cursor !== '0');
  })();
}
