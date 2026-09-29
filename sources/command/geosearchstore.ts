import {
  buildGeoSearchCommand,
  executeCommand,
  tryReplyNumber,
} from './utils/index.ts';

import type {
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchStoreOptions,
} from '../index.ts';

export function createCommand(
  destination: string,
  source: string,
  from: CommandGeoSearchFromOptions,
  by: CommandGeoSearchByOptions,
  options?: CommandGeoSearchStoreOptions,
) {
  const command = buildGeoSearchCommand(
    ['GEOSEARCHSTORE', destination, source],
    from,
    by,
    options,
  );

  if (options?.storedist) {
    command.push('STOREDIST');
  }

  return command;
}

export async function geosearchstore<T>(
  this: T,
  destination: string,
  source: string,
  from: CommandGeoSearchFromOptions,
  by: CommandGeoSearchByOptions,
  options?: CommandGeoSearchStoreOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(destination, source, from, by, options),
    tryReplyNumber,
  );
}
