import { buildHelpExecutor } from './utils/index.ts';

export function createCommand() {
  return ['PUBSUB', 'HELP'];
}

export const pubsubHelp = buildHelpExecutor('PUBSUB');
