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
  return buildGeoSearchCommand(
    ['GEOSEARCHSTORE', destination, source],
    from,
    by,
    options,
  );
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
