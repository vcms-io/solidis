import type {
  SolidisClientFrozenOptions,
  SolidisCommandKind,
} from '../types/solidis.ts';

const KB = 1024 as const;
const MB = 1048576 as const;

const NL = '\r\n' as const;

export const SolidisDefaultOptions: SolidisClientFrozenOptions = {
  authentication: { username: '', password: '' },
  autoReconnect: true,
  autoRecovery: {
    database: true,
    subscribe: true,
    ssubscribe: true,
    psubscribe: true,
  },
  bigIntegers: false,
  clientName: 'solidis',
  commandTimeout: 5000,
  connectionTimeout: 2000,
  connectionRetryDelay: 100,
  database: 0,
  debug: false,
  debugMaxEntries: KB * 10,
  enableReadyCheck: true,
  host: '127.0.0.1',
  uri: false,
  lazyConnect: false,
  maxConnectionRetries: 20,
  maxConnectionRetryDelay: 2000,
  maxCommandsPerPipeline: 300,
  maxEventListenersForClient: KB * 10,
  parser: {
    maxBulkStringLength: MB * 512,
  },
  port: 6379,
  protocol: 'RESP2',
  readyCheckInterval: 100,
  maxReadyCheckRetries: 100,
  rejectOnPartialPipelineError: false,
} as const;

export const SolidisBulkZeroCopyThreshold = KB * 64;

export const SolidisSymbolBytes = {
  ASTERISK: 42,
  DOLLAR: 36,
  CR: 13,
  LF: 10,
  ZERO: 48,
  MINUS: 45,
  COLON: 58,
  LOWER_T: 116,
  LOWER_F: 102,
} as const;

export const SolidisReplyBytes = {
  STRING: 43,
  ERROR: 45,
  INTEGER: 58,
  BULK: 36,
  ARRAY: 42,
  MAP: 37,
  NULL: 95,
  BOOLEAN: 35,
  DOUBLE: 44,
  BIG_NUMBER: 40,
  VERBATIM_STRING: 61,
  BLOB_ERROR: 33,
  SET: 126,
  ATTRIBUTE: 124,
  PUSH: 62,
} as const;

export const SolidisNumberTypes = {
  INFINITY: 'inf',
  NEGATIVE_INFINITY: '-inf',
  NAN: 'nan',
} as const;

export const SolidisStringSymbols = {
  NL,
} as const;

export const SolidisMessageEventNames = [
  'message',
  'pmessage',
  'smessage',
] as const;

export const SolidisSubscribeEventNames = [
  'subscribe',
  'ssubscribe',
  'psubscribe',
] as const;

export const SolidisUnsubscribeEventNames = [
  'unsubscribe',
  'sunsubscribe',
  'punsubscribe',
] as const;

export const SolidisSubscriptionEventNames = [
  ...SolidisSubscribeEventNames,
  ...SolidisUnsubscribeEventNames,
] as const;

export const SolidisSessionCommandKinds = [
  'select',
  'hello',
  'reset',
  'client',
] as const;

export const SolidisUnsupportedCommandNames = [
  'MONITOR',
  'SYNC',
  'PSYNC',
] as const;

export const SolidisPubSubEventNames = [
  ...SolidisMessageEventNames,
  ...SolidisSubscriptionEventNames,
] as const;

export const SolidisCredentialCommandNameSet: ReadonlySet<string> = new Set([
  'AUTH',
  'HELLO',
  'MIGRATE',
  'ACL SETUSER',
  'CONFIG SET',
]);

export const SolidisContainerCommandNameSet: ReadonlySet<string> = new Set([
  'ACL',
  'CLIENT',
  'CLUSTER',
  'COMMAND',
  'CONFIG',
  'DEBUG',
  'FUNCTION',
  'LATENCY',
  'MEMORY',
  'MODULE',
  'OBJECT',
  'PUBSUB',
  'SCRIPT',
  'SLOWLOG',
  'XGROUP',
  'XINFO',
]);

export const SolidisCommandKinds: ReadonlyMap<string, SolidisCommandKind> =
  new Map<string, SolidisCommandKind>([
    ...[...SolidisSubscriptionEventNames, ...SolidisSessionCommandKinds].map(
      (kind) => [kind.toUpperCase(), kind] as const,
    ),
    ...SolidisUnsupportedCommandNames.map(
      (name) => [name, 'unsupported'] as const,
    ),
  ]);
