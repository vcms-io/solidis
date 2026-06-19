import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['MEMORY', 'HELP'];
}

export const memoryHelp = buildHelpExecutor('MEMORY');
