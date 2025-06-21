import {
  buildGeoRadiusCommand,
  executeCommand,
  newCommandError,
  tryReplyToGeoRadius,
  UnexpectedReplyPrefix,
} from './utils/index.ts';

import type {
  CommandGeoSearchOptions,
  CommandGeoUnitOption,
  RespGeoRadius,
} from '../index.ts';

export function createCommand(
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoSearchOptions,
) {
  return buildGeoRadiusCommand(
    ['GEORADIUS_RO', key, `${longitude}`, `${latitude}`, `${radius}`, unit],
    options,
  );
}

export async function georadiusRo<T>(
  this: T,
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoSearchOptions,
): Promise<RespGeoRadius[]> {
  return await executeCommand(
    this,
    createCommand(key, longitude, latitude, radius, unit, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return tryReplyToGeoRadius(reply, 'GEORADIUS_RO', options);
    },
  );
}
