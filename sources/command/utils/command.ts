import {
  escapeReply,
  newCommandError,
  tryReplyNumber,
  tryReplyOK,
  tryReplyToScan,
  tryReplyToString,
  tryReplyToStringArray,
  tryReplyToStringOrNull,
} from './index.ts';

import type {
  CommandCuckooFilterInsertOptions,
  CommandExpireMode,
  CommandGeoRadiusOptions,
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchOptions,
  CommandScanOptions,
  CommandSetOptions,
  CommandSortOptions,
  CommandTimeSeriesOptions,
  CommandTimeSeriesRangeOptions,
  CommandZInterOptions,
  CommandZRangeOptions,
  CommandZRangeStoreOptions,
  RespOK,
  SolidisClient,
  SolidisData,
  StringOrBuffer,
} from '../../index.ts';

export function guard(
  client: unknown,
  command?: StringOrBuffer[],
): client is SolidisClient {
  if (typeof client !== 'object' || client === null) {
    throw newCommandError('This is not a valid solidis client', command);
  }

  if (!('send' in client) || typeof client.send !== 'function') {
    throw newCommandError('Send method is not implemented', command);
  }

  /**
   * Returns false only when the client is in a transaction context
   */
  if ('pipeQueue' in client && Array.isArray(client.pipeQueue) && command) {
    client.pipeQueue.push(command);

    return false;
  }

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
): Promise<R>;
export async function executeCommand<T, R>(
  client: T,
  command: StringOrBuffer[],
  replyTo?: (reply: SolidisData, command: StringOrBuffer[]) => R,
): Promise<R | SolidisData> {
  if (!guard(client, command)) {
    return undefined as never;
  }

  const reply = escapeReply(await client.send([command]));

  return replyTo ? replyTo(reply, command) : reply;
}

export function buildCuckooFilterInsertCommand(
  command: string,
  key: string,
  items: string[],
  options?: CommandCuckooFilterInsertOptions,
) {
  const result = [command, key];

  if (options) {
    if (options.capacity !== undefined && options.nocreate !== true) {
      result.push('CAPACITY', `${options.capacity}`);
    }

    if (options.nocreate === true) {
      result.push('NOCREATE');
    }
  }

  result.push('ITEMS', ...items);

  return result;
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
    command.push('COUNT', `${options.count}`);
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

  if (options?.store) {
    command.push('STORE', options.store);
  }

  if (options?.storedist) {
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

  if (from.frommember) {
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

  if (options !== undefined) {
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

  if (options.count) {
    command.push('COUNT', `${options.count}`);
  }

  if (options.match) {
    command.push('MATCH', options.match);
  }

  if (options.type) {
    command.push('TYPE', options.type);
  }

  return command;
}

export function buildTimeSeriesCommand<
  T extends CommandTimeSeriesOptions = CommandTimeSeriesOptions,
>(baseCommand: string[], options: T) {
  const command = [...baseCommand];

  if (options.retention !== undefined) {
    command.push('RETENTION', `${options.retention}`);
  }

  if (options.encoding) {
    command.push('ENCODING', options.encoding);
  }

  if (options.chunkSize !== undefined) {
    command.push('CHUNK_SIZE', `${options.chunkSize}`);
  }

  if (options.duplicatePolicy) {
    command.push('DUPLICATE_POLICY', options.duplicatePolicy);
  }

  if ('onDuplicate' in options && options.onDuplicate) {
    command.push('ON_DUPLICATE', options.onDuplicate);
  }

  if (options.labels) {
    command.push('LABELS');
    for (const [label, value] of Object.entries(options.labels)) {
      command.push(label, value);
    }
  }

  if (options.ignore) {
    command.push(
      'IGNORE',
      `${options.ignore.maxTimediff}`,
      `${options.ignore.maxValDiff}`,
    );
  }

  return command;
}

export function buildTimeSeriesRangeCommand(
  baseCommand: string[],
  options: CommandTimeSeriesRangeOptions,
) {
  const command = [...baseCommand];

  if (options.filterByTs?.length) {
    for (const [start, end] of options.filterByTs) {
      command.push('FILTER_BY_TS', `${start}`, `${end}`);
    }
  }

  if (options.filterByValue?.length) {
    for (const [min, max] of options.filterByValue) {
      command.push('FILTER_BY_VALUE', `${min}`, `${max}`);
    }
  }

  if (options.count !== undefined) {
    command.push('COUNT', `${options.count}`);
  }

  if (options.align !== undefined) {
    command.push('ALIGN', `${options.align}`);
  }

  if (options.aggregation) {
    command.push(
      'AGGREGATION',
      options.aggregation.type,
      `${options.aggregation.bucketDuration}`,
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

  if (options.weights?.length) {
    command.push('WEIGHTS', ...options.weights.map((weight) => `${weight}`));
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
    command.push('LIMIT', `${options.limit.offset}`, `${options.limit.count}`);
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
    if (!guard(this)) {
      return undefined as never;
    }

    await this.send([[commandName, ...channels]]);
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
  const command = [commandName, key, `${value}`];

  if (mode) {
    command.push(mode);
  }

  command.push('FIELDS', `${fields.length}`, ...fields);

  return command;
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
  options?: CommandSortOptions,
) {
  const command = [commandName, key];

  if (options) {
    if (options.by !== undefined) {
      command.push('BY', options.by);
    }

    if (options.limit) {
      command.push(
        'LIMIT',
        `${options.limit.offset}`,
        `${options.limit.count}`,
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
    command.push('EX', `${options.expireInSeconds}`);
  }

  if (options.expireInMilliseconds !== undefined) {
    command.push('PX', `${options.expireInMilliseconds}`);
  }

  if (options.expireAtSeconds !== undefined) {
    command.push('EXAT', `${options.expireAtSeconds}`);
  }

  if (options.expireAtMilliseconds !== undefined) {
    command.push('PXAT', `${options.expireAtMilliseconds}`);
  }
}

export async function* createScanIterator<T, R>(
  client: T,
  baseCommand: string[],
  options: CommandScanOptions,
  parseElements: (elements: unknown, commandName: StringOrBuffer[]) => R,
): AsyncGenerator<R> {
  let cursor = '0';

  do {
    const command = buildScanCommand(baseCommand, cursor, options);
    const reply = await executeCommand(client, command);
    const [newCursor, elements] = tryReplyToScan(reply);

    cursor = newCursor;

    yield parseElements(elements, command);
  } while (cursor !== '0');
}
