import { buildKeyStringArrayExecutor } from './utils/index.ts';

export const smembers = buildKeyStringArrayExecutor('SMEMBERS');
