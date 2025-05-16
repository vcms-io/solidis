import {
  InvalidReplyPrefix,
  UnexpectedReplyPrefix,
  executeCommand,
  newCommandError,
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
    (reply, command) => {
      if (!Array.isArray(reply)) {
        throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, command);
      }

      return reply.map((pos) => {
        if (pos === null) {
          return null;
        }

        if (!Array.isArray(pos) || pos.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${pos}`, command);
        }

        const [longitude, latitude] = pos;

        if (typeof longitude !== 'string' && !(longitude instanceof Buffer)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${longitude}`, command);
        }

        if (typeof latitude !== 'string' && !(latitude instanceof Buffer)) {
          throw newCommandError(`${InvalidReplyPrefix}: ${latitude}`, command);
        }

        const lon = Number.parseFloat(`${longitude}`);
        const lat = Number.parseFloat(`${latitude}`);

        if (Number.isNaN(lon) || Number.isNaN(lat)) {
          throw newCommandError(
            `${InvalidReplyPrefix}: ${longitude},${latitude}`,
            command,
          );
        }

        return { longitude: lon, latitude: lat };
      });
    },
  );
}
