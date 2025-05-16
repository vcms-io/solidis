import { executeCommand, tryReplyToNumberOrNull } from './utils/index.ts';

import type { CommandGeoUnitOption } from '../index.ts';

export function createCommand(
  key: string,
  member1: string,
  member2: string,
  unit?: CommandGeoUnitOption,
) {
  const command = ['GEODIST', key, member1, member2];

  if (unit) {
    command.push(unit);
  }

  return command;
}

export async function geodist<T>(
  this: T,
  key: string,
  member1: string,
  member2: string,
  unit?: CommandGeoUnitOption,
): Promise<number | null> {
  return await executeCommand(
    this,
    createCommand(key, member1, member2, unit),
    tryReplyToNumberOrNull,
  );
}
