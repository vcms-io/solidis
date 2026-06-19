import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['ACL', 'HELP'];
}

export const aclHelp = buildHelpExecutor('ACL');
