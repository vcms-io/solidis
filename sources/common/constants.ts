import type { SolidisClientFrozenOptions } from '../index.ts';

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
  maxCommandsPerPipeline: 300,
  maxEventListenersForClient: KB * 10,
  maxEventListenersForSocket: KB * 10,
  maxProcessReplyBytesPerChunk: KB * 8192,
  maxProcessRepliesPerChunk: KB * 4,
  maxSocketWriteSizePerOnce: KB * 64,
  parser: {
    buffer: {
      initial: MB * 4,
      shiftThreshold: MB * 2,
    },
    maxBulkStringLength: MB * 512,
  },
  port: 6379,
  protocol: 'RESP2',
  readyCheckInterval: 100,
  maxReadyCheckRetries: 100,
  rejectOnPartialPipelineError: false,
  socketWriteTimeout: 1000,
  useTLS: false,
} as const;

export const SolidisSymbolBytes = {
  ASTERISK: 42,
  DOLLAR: 36,
  CR: 13,
  LF: 10,
  ZERO: 48,
  LOWER_T: 116,
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

export const SolidisPubSubEventNames = [
  ...[
    'message',
    'pmessage',
    'smessage',
    'subscribe',
    'ssubscribe',
    'psubscribe',
    'unsubscribe',
    'sunsubscribe',
    'punsubscribe',
  ].map((name) => Buffer.from(name).toString('latin1')),
] as const;

export const SolidisPubSubEventNameSet = new Set(SolidisPubSubEventNames);

export const SolidisMessageEventNameSet = new Set([
  'message',
  'pmessage',
  'smessage',
]);

export const SolidisSubscribeCommandNameSet = new Set([
  'SUBSCRIBE',
  'SSUBSCRIBE',
  'PSUBSCRIBE',
  'UNSUBSCRIBE',
  'SUNSUBSCRIBE',
  'PUNSUBSCRIBE',
]);
