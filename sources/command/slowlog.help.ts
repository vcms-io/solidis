import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['SLOWLOG', 'HELP'];
}

export const slowlogHelp = buildHelpExecutor('SLOWLOG');
