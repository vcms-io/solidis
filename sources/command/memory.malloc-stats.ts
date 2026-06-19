import { buildWithoutArgumentsStringExecutor } from './utils/index.ts';

export const memoryMallocStats = buildWithoutArgumentsStringExecutor(
  'MEMORY',
  'MALLOC-STATS',
);
