import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['COMMAND', 'HELP'];
}

export const commandHelp = buildHelpExecutor('COMMAND');
