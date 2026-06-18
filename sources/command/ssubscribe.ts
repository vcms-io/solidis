import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SSUBSCRIBE', ...channels];
}

export const ssubscribe = buildPubSubExecutor('SSUBSCRIBE');
