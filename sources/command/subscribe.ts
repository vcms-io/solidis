import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...channels: string[]) {
  return ['SUBSCRIBE', ...channels];
}

export const subscribe = buildPubSubExecutor('SUBSCRIBE');
