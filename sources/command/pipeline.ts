import { assertSender } from './utils/index.ts';

import type { SolidisData, StringOrBuffer } from '../index.ts';

export async function pipeline<T>(
  this: T,
  commands: StringOrBuffer[][],
): Promise<SolidisData[]> {
  assertSender(this);

  const replies = await this.send(commands);

  return replies.map((reply) => (reply.length > 1 ? reply : reply[0]));
}
