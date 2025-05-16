import {
  UnexpectedReplyPrefix,
  buildGeoRadiusCommand,
  executeCommand,
  newCommandError,
  tryReplyToGeoRadius,
} from './utils/index.ts';

import type {
  CommandGeoSearchOptions,
  CommandGeoUnitOption,
  RespGeoRadius,
} from '../index.ts';

export function createCommand(
  key: string,
  member: string,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoSearchOptions,
) {
  return buildGeoRadiusCommand(
    ['GEORADIUSBYMEMBER_RO', key, member, `${radius}`, unit],
    options,
  );
}

export async function georadiusbymemberRo<T>(
  this: T,
  key: string,
  member: string,
  radius: number,
  unit: CommandGeoUnitOption,
  options?: CommandGeoSearchOptions,
): Promise<RespGeoRadius[]> {
  return await executeCommand(
    this,
    createCommand(key, member, radius, unit, options),
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return tryReplyToGeoRadius(reply, 'GEORADIUSBYMEMBER_RO', options);
    },
  );
}
