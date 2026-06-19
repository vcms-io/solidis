import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['FUNCTION', 'HELP'];
}

export const functionHelp = buildHelpExecutor('FUNCTION');
