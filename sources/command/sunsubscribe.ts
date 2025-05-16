import { guard } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SUNSUBSCRIBE', ...channels];
}

export async function sunsubscribe<T>(
  this: T,
  ...channels: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...channels)]);
}
