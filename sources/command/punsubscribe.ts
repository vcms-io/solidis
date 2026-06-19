import { buildPubSubExecutor } from './utils/index.ts';

export function createCommand(...patterns: string[]) {
  return ['PUNSUBSCRIBE', ...patterns];
}

export const punsubscribe = buildPubSubExecutor('PUNSUBSCRIBE');
