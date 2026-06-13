import {
  executeCommand,
  InvalidReplyPrefix,
  newCommandError,
  tryReplyToNumber,
  UnexpectedReplyPrefix,
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

      return reply.map((position) => {
        if (position === null) {
          return null;
        }

        if (!Array.isArray(position) || position.length !== 2) {
          throw newCommandError(`${InvalidReplyPrefix}: ${position}`, command);
        }

        const [longitude, latitude] = position;

        /**
         * RESP2 encodes coordinates as bulk strings; RESP3 returns native
         * doubles. tryReplyToNumber normalises both shapes.
         */
        return {
          longitude: tryReplyToNumber(longitude, command),
          latitude: tryReplyToNumber(latitude, command),
        };
      });
    },
  );
}
