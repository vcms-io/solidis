import { guard } from './utils/index.ts';

export function createCommand(...patterns: string[]) {
  return ['PSUBSCRIBE', ...patterns];
}

export async function psubscribe<T>(
  this: T,
  ...patterns: string[]
): Promise<void> {
  if (!guard(this)) {
    return undefined as never;
  }

  await this.send([createCommand(...patterns)]);
}
