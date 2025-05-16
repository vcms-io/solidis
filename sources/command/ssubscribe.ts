import { guard } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SSUBSCRIBE', ...channels];
}

export async function ssubscribe<T>(
  this: T,
  ...channels: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...channels)]);
}
