import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['CLIENT', 'HELP'];
}

export const clientHelp = buildHelpExecutor('CLIENT');
