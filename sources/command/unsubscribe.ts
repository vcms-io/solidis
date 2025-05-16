import { guard } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['UNSUBSCRIBE', ...channels];
}

export async function unsubscribe<T>(
  this: T,
  ...channels: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...channels)]);
}
