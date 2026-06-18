import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['XGROUP', 'HELP'];
}

export const xgroupHelp = buildHelpExecutor('XGROUP');
