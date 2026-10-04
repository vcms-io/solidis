export const SolidisAsteriskByte = 42;
export const SolidisDollarByte = 36;
export const SolidisCarriageReturnByte = 13;
export const SolidisLineFeedByte = 10;
export const SolidisZeroByte = 48;
export const SolidisMinusByte = 45;
export const SolidisColonByte = 58;
export const SolidisLowercaseTByte = 116;
export const SolidisLowercaseFByte = 102;

export const SolidisStringReplyByte = 43;
export const SolidisErrorReplyByte = 45;
export const SolidisIntegerReplyByte = 58;
export const SolidisBulkReplyByte = 36;
export const SolidisArrayReplyByte = 42;
export const SolidisMapReplyByte = 37;
export const SolidisNullReplyByte = 95;
export const SolidisBooleanReplyByte = 35;
export const SolidisDoubleReplyByte = 44;
export const SolidisBigNumberReplyByte = 40;
export const SolidisVerbatimStringReplyByte = 61;
export const SolidisBlobErrorReplyByte = 33;
export const SolidisSetReplyByte = 126;
export const SolidisAttributeReplyByte = 124;
export const SolidisPushReplyByte = 62;

export const SolidisInfinityText = 'inf';
export const SolidisNegativeInfinityText = '-inf';
export const SolidisNotANumberText = 'nan';

export const SolidisNewLine = '\r\n';

export const SolidisKilobyte = 1024;
export const SolidisMegabyte = 1048576;
export const SolidisDebugPreviewLength = 1024;
export const SolidisLinePreviewLength = 32;
export const SolidisBulkZeroCopyThreshold = 65536;
export const SolidisMaximumTimerDelay = 2147483647;
export const SolidisIntegerMaximumLength = 20;
export const SolidisBigNumberMaximumLength = 4096;
export const SolidisMaximumNestingDepth = 512;
export const SolidisCommandKindCacheLimit = 1024;

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
  'SENTINEL',
  'SLOWLOG',
  'XGROUP',
  'XINFO',
]);

export function toTextPrefix(argument: string | Buffer, length: number) {
  return typeof argument === 'string'
    ? argument.slice(0, length)
    : argument.toString('utf8', 0, length * 4);
}

export function resolveTimerDelay(delay: number) {
  return delay > 0 && delay <= SolidisMaximumTimerDelay ? delay : 0;
}

export const SolidisSocketNotConnectedMessage = 'Socket is not connected.';
export const SolidisAuthenticationFailedMessage = 'Authentication failed';
export const SolidisAuthenticationErrorPattern = /^(WRONGPASS|NOAUTH)/;
export const SolidisClientQuitMessage = 'The client was quit.';
