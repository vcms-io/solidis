import {
  UnexpectedReplyPrefix,
  guard,
  newCommandError,
} from './utils/index.ts';

import type { SolidisData, StringOrBuffer } from '../index.ts';

export async function pipeline<T>(
  this: T,
  commands: StringOrBuffer[][],
): Promise<SolidisData[]> {
  if (!guard(this)) {
    return undefined as never;
  }

  const reply = await this.send(commands);
  const lastReply = reply.at(-1);

  if (Array.isArray(lastReply)) {
    const [results] = lastReply;

    if (Array.isArray(results)) {
      return results;
    }

    return lastReply;
  }

  throw newCommandError(`${UnexpectedReplyPrefix}: ${reply}`, 'PIPELINE');
}
