import { buildKeyStringOrNullExecutor } from './utils/index.ts';

export const lpop = buildKeyStringOrNullExecutor('LPOP');
