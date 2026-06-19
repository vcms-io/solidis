import { buildPubSubExecutor } from './utils/index.ts';

export const unsubscribe = buildPubSubExecutor('UNSUBSCRIBE');
