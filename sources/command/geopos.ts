import {
  executeCommand,
  tryReplyArray,
  tryReplyToNumber,
  tryReplyTuple,
} from './utils/index.ts';

import type { RespGeoPosition } from '../index.ts';

export function createCommand(key: string, members: string[]) {
  return ['GEOPOS', key, ...members];
}

export async function geopos<T>(
  this: T,
  key: string,
  members: string[],
): Promise<Array<RespGeoPosition | null>> {
  return await executeCommand(
    this,
    createCommand(key, members),
    (reply, command) =>
      tryReplyArray(reply, command).map((position) => {
        if (position === null) {
          return null;
        }

        const [longitude, latitude] = tryReplyTuple(position, 2, command);

        return {
          longitude: tryReplyToNumber(longitude, command),
          latitude: tryReplyToNumber(latitude, command),
        };
      }),
  );
}
