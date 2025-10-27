import {
  buildGeoSearchCommand,
  executeCommand,
  newCommandError,
  tryReplyToGeoRadius,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type {
  CommandGeoSearchByOptions,
  CommandGeoSearchFromOptions,
  CommandGeoSearchOptions,
  RespGeoRadius,
} from '../index.ts';

export function createCommand(
  key: string,
  from: CommandGeoSearchFromOptions,
  by: CommandGeoSearchByOptions,
  options?: CommandGeoSearchOptions,
) {
  return buildGeoSearchCommand(['GEOSEARCH', key], from, by, options);
}

export async function geosearch<T>(
  this: T,
  key: string,
  from: CommandGeoSearchFromOptions,
  by: CommandGeoSearchByOptions,
  options?: CommandGeoSearchOptions,
): Promise<RespGeoRadius[]> {
  return await executeCommand(
    this,
    createCommand(key, from, by, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return tryReplyToGeoRadius(reply, 'GEOSEARCH', options);
    },
  );
}
