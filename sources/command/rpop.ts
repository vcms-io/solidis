import { buildKeyStringOrNullExecutor } from './utils/index.ts';

export const rpop = buildKeyStringOrNullExecutor('RPOP');
