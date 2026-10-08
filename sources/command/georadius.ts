import { readGeoReplyOptions } from '../common/utils/internal.ts';
import {
  buildGeoRadiusCommand,
  executeCommand,
  tryReplyToGeoRadiusOrStoreCount,
} from './utils/index.ts';

import type {
  CommandGeoRadiusOptions,
  CommandGeoUnitOption,
  RespGeoRadius,
} from '../index.ts';

export function createCommand(
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions,
) {
  return buildGeoRadiusCommand(
    [
      'GEORADIUS',
      key,
      `${longitude}`,
      `${latitude}`,
      `${radius}`,
      unit.toLowerCase(),
    ],
    options,
  );
}

export async function georadius<T>(
  this: T,
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options: CommandGeoRadiusOptions &
    ({ store: string } | { storedist: string }),
): Promise<number>;
export async function georadius<T>(
  this: T,
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions & {
    store?: undefined;
    storedist?: undefined;
  },
): Promise<RespGeoRadius[]>;
export async function georadius<T>(
  this: T,
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions,
): Promise<RespGeoRadius[] | number>;
export async function georadius<T>(
  this: T,
  key: string,
  longitude: number,
  latitude: number,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions,
): Promise<RespGeoRadius[] | number> {
  return await executeCommand(
    this,
    createCommand(key, longitude, latitude, radius, unit, options),
    tryReplyToGeoRadiusOrStoreCount,
    readGeoReplyOptions(options),
  );
}
