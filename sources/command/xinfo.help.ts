import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['XINFO', 'HELP'];
}

export const xinfoHelp = buildHelpExecutor('XINFO');
