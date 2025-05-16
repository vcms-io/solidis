import { guard } from './utils/index.ts';

export function createCommand(...patterns: string[]) {
  return ['PUNSUBSCRIBE', ...patterns];
}

export async function punsubscribe<T>(
  this: T,
  ...patterns: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...patterns)]);
}
