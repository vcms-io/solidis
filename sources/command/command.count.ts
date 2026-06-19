import { buildWithoutArgumentsNumberExecutor } from './utils/index.ts';

export const commandCount = buildWithoutArgumentsNumberExecutor(
  'COMMAND',
  'COUNT',
);
