import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...patterns: string[]) {
  return ['PSUBSCRIBE', ...patterns];
}

export const psubscribe = buildPubSubExecutor('PSUBSCRIBE');
