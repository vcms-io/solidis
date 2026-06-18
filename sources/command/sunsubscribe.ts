import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SUNSUBSCRIBE', ...channels];
}

export const sunsubscribe = buildPubSubExecutor('SUNSUBSCRIBE');
