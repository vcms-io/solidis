import { buildKeyNumberExecutor } from './utils/index.ts';

export const hlen = buildKeyNumberExecutor('HLEN');
