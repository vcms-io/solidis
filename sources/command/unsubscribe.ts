import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['UNSUBSCRIBE', ...channels];
}

export const unsubscribe = buildPubSubExecutor('UNSUBSCRIBE');
