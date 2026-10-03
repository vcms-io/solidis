import {
  SolidisArrayReplyByte,
  SolidisAsteriskByte,
  SolidisAttributeReplyByte,
  SolidisBigNumberReplyByte,
  SolidisBlobErrorReplyByte,
  SolidisBooleanReplyByte,
  SolidisBulkReplyByte,
  SolidisCarriageReturnByte,
  SolidisColonByte,
  SolidisDollarByte,
  SolidisDoubleReplyByte,
  SolidisErrorReplyByte,
  SolidisInfinityText,
  SolidisIntegerReplyByte,
  SolidisKilobyte,
  SolidisLineFeedByte,
  SolidisLowercaseFByte,
  SolidisLowercaseTByte,
  SolidisMapReplyByte,
  SolidisMegabyte,
  SolidisMinusByte,
  SolidisNegativeInfinityText,
  SolidisNewLine,
  SolidisNotANumberText,
  SolidisNullReplyByte,
  SolidisPushReplyByte,
  SolidisSetReplyByte,
  SolidisStringReplyByte,
  SolidisVerbatimStringReplyByte,
  SolidisZeroByte,
} from './internal.ts';

import type { SolidisClientFrozenOptions } from '../types/solidis.ts';

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
  debugMaxEntries: SolidisKilobyte * 10,
  enableReadyCheck: true,
  host: '127.0.0.1',
  uri: false,
  lazyConnect: false,
  maxConnectionRetries: 20,
  maxConnectionRetryDelay: 2000,
  maxCommandsPerPipeline: 300,
  maxEventListenersForClient: SolidisKilobyte * 10,
  parser: {
    maxBulkStringLength: SolidisMegabyte * 512,
  },
  port: 6379,
  protocol: 'RESP2',
  readyCheckInterval: 100,
  maxReadyCheckRetries: 100,
  rejectOnPartialPipelineError: false,
} as const;

export const SolidisSymbolBytes = {
  ASTERISK: SolidisAsteriskByte,
  DOLLAR: SolidisDollarByte,
  CR: SolidisCarriageReturnByte,
  LF: SolidisLineFeedByte,
  ZERO: SolidisZeroByte,
  MINUS: SolidisMinusByte,
  COLON: SolidisColonByte,
  LOWER_T: SolidisLowercaseTByte,
  LOWER_F: SolidisLowercaseFByte,
} as const;

export const SolidisReplyBytes = {
  STRING: SolidisStringReplyByte,
  ERROR: SolidisErrorReplyByte,
  INTEGER: SolidisIntegerReplyByte,
  BULK: SolidisBulkReplyByte,
  ARRAY: SolidisArrayReplyByte,
  MAP: SolidisMapReplyByte,
  NULL: SolidisNullReplyByte,
  BOOLEAN: SolidisBooleanReplyByte,
  DOUBLE: SolidisDoubleReplyByte,
  BIG_NUMBER: SolidisBigNumberReplyByte,
  VERBATIM_STRING: SolidisVerbatimStringReplyByte,
  BLOB_ERROR: SolidisBlobErrorReplyByte,
  SET: SolidisSetReplyByte,
  ATTRIBUTE: SolidisAttributeReplyByte,
  PUSH: SolidisPushReplyByte,
} as const;

export const SolidisNumberTypes = {
  INFINITY: SolidisInfinityText,
  NEGATIVE_INFINITY: SolidisNegativeInfinityText,
  NAN: SolidisNotANumberText,
} as const;

export const SolidisStringSymbols = {
  NL: SolidisNewLine,
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

export const SolidisPubSubEventNames = [
  ...SolidisMessageEventNames,
  ...SolidisSubscriptionEventNames,
] as const;

export const SolidisTransactionBannedCommandNames = [
  'multi',
  'pipeline',
  'watch',
  'unwatch',
  'subscribe',
  'ssubscribe',
  'psubscribe',
  'unsubscribe',
  'sunsubscribe',
  'punsubscribe',
  'auth',
  'hello',
  'reset',
] as const;

export const SolidisCredentialCommandNameSet: ReadonlySet<string> = new Set([
  'AUTH',
  'HELLO',
  'MIGRATE',
  'ACL SETUSER',
  'CONFIG SET',
]);
