import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['CONFIG', 'HELP'];
}

export const configHelp = buildHelpExecutor('CONFIG');
