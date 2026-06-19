import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['SCRIPT', 'HELP'];
}

export const scriptHelp = buildHelpExecutor('SCRIPT');
