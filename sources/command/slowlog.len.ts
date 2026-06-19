import { buildWithoutArgumentsNumberExecutor } from './utils/index.ts';

export const slowlogLen = buildWithoutArgumentsNumberExecutor('SLOWLOG', 'LEN');
