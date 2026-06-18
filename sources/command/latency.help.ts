import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['LATENCY', 'HELP'];
}

export const latencyHelp = buildHelpExecutor('LATENCY');
