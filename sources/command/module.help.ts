import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['MODULE', 'HELP'];
}

export const moduleHelp = buildHelpExecutor('MODULE');
