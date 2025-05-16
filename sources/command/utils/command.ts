import { escapeReply, newCommandError } from './index.ts';

import type {
  CommandCuckooFilterInsertOptions,
  CommandGeoRadiusOptions,
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchOptions,
  CommandScanOptions,
  CommandSetOptions,
  CommandTimeSeriesOptions,
  CommandTimeSeriesRangeOptions,
  CommandZInterOptions,
  CommandZRangeOptions,
  CommandZRangeStoreOptions,
  SolidisClient,
  SolidisData,
  StringOrBuffer,
} from '../../index.ts';

export function guard(
  T: unknown,
  command?: StringOrBuffer[],
): T is SolidisClient {
  if (typeof T !== 'object' || T === null) {
    throw newCommandError('This is not a valid solidis client', command);
  }

  if (!('send' in T) || typeof T.send !== 'function') {
    throw newCommandError('Send method is not implemented', command);
  }

  /**
   * Returns false only when the client is in a transaction context
   */
  if ('pipeQueue' in T && Array.isArray(T.pipeQueue) && command) {
    T.pipeQueue.push(command);

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

export function buildGeoRadiusCommand(
  baseCommand: string[],
  options?: CommandGeoRadiusOptions,
) {
  const command = [...baseCommand];

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
      by.bybox.unit,
    );
  } else if (by.byradius) {
    command.push('BYRADIUS', `${by.byradius.radius}`, by.byradius.unit);
  }

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

  return command;
}

export function buildSetCommand(
  key: string,
  value: StringOrBuffer,
  options?: CommandSetOptions,
) {
  const command = ['SET', key, value];

  if (options !== undefined) {
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
