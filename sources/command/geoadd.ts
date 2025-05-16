import { executeCommand, tryReplyNumber } from './utils/index.ts';

import type {
  CommandGeoAddMemberOption,
  CommandGeoAddOptions,
} from '../index.ts';

export function createCommand(
  key: string,
  members: CommandGeoAddMemberOption[],
  options?: CommandGeoAddOptions,
) {
  const command = ['GEOADD', key];

  if (options?.nx) {
    command.push('NX');
  }

  if (options?.xx) {
    command.push('XX');
  }

  if (options?.ch) {
    command.push('CH');
  }

  for (const { longitude, latitude, member } of members) {
    command.push(`${longitude}`, `${latitude}`, `${member}`);
  }

  return command;
}

export async function geoadd<T>(
  this: T,
  key: string,
  members: CommandGeoAddMemberOption[],
  options?: CommandGeoAddOptions,
): Promise<number> {
  return await executeCommand(
    this,
    createCommand(key, members, options),
    tryReplyNumber,
  );
}
