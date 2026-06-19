import { buildWithoutArgumentsOKExecutor } from './utils/index.ts';

export const slowlogReset = buildWithoutArgumentsOKExecutor('SLOWLOG', 'RESET');
