import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['OBJECT', 'HELP'];
}

export const objectHelp = buildHelpExecutor('OBJECT');
