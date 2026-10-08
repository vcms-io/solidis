import { buildKeyIntegerExecutor } from './utils/index.ts';

export const decr = buildKeyIntegerExecutor('DECR');
