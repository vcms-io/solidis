import { guard } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SUBSCRIBE', ...channels];
}

export async function subscribe<T>(
  this: T,
  ...channels: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...channels)]);
}
