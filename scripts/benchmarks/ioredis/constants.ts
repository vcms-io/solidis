/**
 * Mirrors ioredis 5.11.1 built/autoPipelining.js notAllowedAutoPipelineCommands.
 */
export const ioredisAutoPipelineExcludedCommands = new Set([
  'auth',
  'client',
  'cluster',
  'info',
  'multi',
  'pipeline',
  'psubscribe',
  'quit',
  'script',
  'select',
  'subscribe',
  'unsubscribe',
  'unpsubscribe',
]);
