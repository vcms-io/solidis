import { buildKeyNumberExecutor } from './utils/index.ts';

export const llen = buildKeyNumberExecutor('LLEN');
