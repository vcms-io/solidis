import {
  UnexpectedReplyPrefix,
  buildGeoRadiusCommand,
  executeCommand,
  newCommandError,
  tryReplyToGeoRadius,
} from './utils/index.ts';

import type {
  CommandGeoRadiusOptions,
  CommandGeoUnitOption,
  RespGeoRadius,
} from '../index.ts';

export function createCommand(
  key: string,
  member: string,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions,
) {
  return buildGeoRadiusCommand(
    ['GEORADIUSBYMEMBER', key, member, `${radius}`, unit],
    options,
  );
}

export async function georadiusbymember<T>(
  this: T,
  key: string,
  member: string,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoRadiusOptions,
): Promise<RespGeoRadius[] | number> {
  return await executeCommand(
    this,
    createCommand(key, member, radius, unit, options),
    (reply, command) => {
      if (typeof reply === 'number') {
        return reply;
      }

      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return tryReplyToGeoRadius(reply, 'GEORADIUSBYMEMBER', options);
    },
  );
}
