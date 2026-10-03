import type { CommandExclusiveOptions } from './command.ts';
import type { SolidisData } from './solidis.ts';

export const RespDataTypes = {
  STRING: 'STRING',
  LIST: 'LIST',
  SET: 'SET',
  ZSET: 'ZSET',
  HASH: 'HASH',
  STREAM: 'STREAM',
} as const;
export type RespDataTypes = keyof typeof RespDataTypes;

export const RespOK = 'OK' as const;
export type RespOK = typeof RespOK;
export const RespNoKey = 'NOKEY' as const;
export type RespNoKey = typeof RespNoKey;
export type RespOnOrOff = 'ON' | 'OFF';
export type RespYesOrNo = 'YES' | 'NO';
export type RespEncoding = 'COMPRESSED' | 'UNCOMPRESSED';
export type RespDuplicatePolicy =
  | 'BLOCK'
  | 'FIRST'
  | 'LAST'
  | 'MIN'
  | 'MAX'
  | 'SUM';
export type RespBit = 0 | 1;
export type RespBitOperation =
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'NOT'
  | 'DIFF'
  | 'DIFF1'
  | 'ANDOR'
  | 'ONE';
export type RespBitfield = `i${number}` | `u${number}`;
export type RespBitfieldOverflow = 'WRAP' | 'SAT' | 'FAIL';
export type RespHashField = Record<string, string>;
type RespOptionResult<Options, Key extends string, Enabled, Disabled> =
  Options extends Record<Key, true>
    ? Enabled
    : Options extends object
      ? Key extends keyof Options
        ? true extends Options[Key]
          ? Enabled | Disabled
          : Disabled
        : Disabled
      : Disabled;
export type RespInteger<Options> = RespOptionResult<
  Options,
  'bigint',
  bigint,
  number
>;
export type RespString<Options> = RespOptionResult<
  Options,
  'buffer',
  Buffer,
  string
>;
export type RespSetMember = string;
export type RespListMember = string;
export const RespJsonType = [
  'null',
  'boolean',
  'integer',
  'number',
  'string',
  'object',
  'array',
  'none',
] as const;
export type RespJsonType = (typeof RespJsonType)[number];
export type RespLatencyEvent =
  | 'active-defrag-cycle'
  | 'aof-fsync-always'
  | 'aof-fstat'
  | 'aof-rewrite-diff-write'
  | 'aof-rename'
  | 'aof-write'
  | 'aof-write-active-child'
  | 'aof-write-alone'
  | 'aof-write-pending-fsync'
  | 'command'
  | 'expire-cycle'
  | 'expire-del'
  | 'eviction-cycle'
  | 'eviction-del'
  | 'eviction-lazyfree'
  | 'fast-command'
  | 'fork'
  | 'rdb-unlink-temp-file'
  | 'while-blocked-cron';

export interface RespAclLogEntry {
  count: number;
  reason: string;
  context: string;
  object: string;
  username: string;
  ageSeconds: number;
  clientInfo: string;
  entryId: number;
  timestampCreated: number;
  timestampLastUpdated: number;
}
export interface RespAclSelector {
  commands: string;
  keys: string;
  channels: string;
}
export interface RespAclUserInfo {
  flags: string[];
  passwords: string[];
  commands: string;
  keys: string;
  channels: string;
  selectors: RespAclSelector[];
}
export interface RespBloomFilterInfo {
  capacity: number;
  size: number;
  numberOfFilters: number;
  numberOfItemsInserted: number;
  expansionRate: number;
}
export interface RespCommandArgument {
  name: string;
  type: string;
  optional?: boolean;
  multiple?: boolean;
  arguments?: RespCommandArgument[];
}
export type RespCommandSubcommands = Record<string, RespCommandDoc>;
export interface RespCommandDoc {
  summary?: string;
  since?: string;
  group?: string;
  complexity?: string;
  docFlags?: Array<'deprecated' | 'syscmd'>;
  deprecatedSince?: string;
  replacedBy?: string;
  history?: string[];
  arguments?: RespCommandArgument[];
  subcommands?: RespCommandSubcommands;
}
export interface RespCommandKeyFlag {
  key: string;
  flags: string[];
}
export type RespCommandListFilter = CommandExclusiveOptions<
  { module?: string } | { aclcat?: string } | { pattern?: string }
>;
export interface RespCuckooFilterInfo {
  size: number;
  numberOfBuckets: number;
  numberOfFilter: number;
  numberOfItemsInserted: number;
  numberOfItemsDeleted: number;
  bucketSize: number;
  expansionRate: number;
  maxIteration: number;
}
export interface RespFunctionListFunction {
  name: string;
  description: string | null;
  flags: string[];
}
export interface RespFunctionListItem {
  libraryName: string;
  engine: string;
  functions: RespFunctionListFunction[];
  code?: string;
}
export interface RespFunctionStats {
  runningScript: {
    name: string;
    command: string;
    duration: number;
  } | null;
  engines: Array<{
    name: string;
    libraries: number;
    functions: number;
  }>;
}
export interface RespGeoPosition {
  longitude: number;
  latitude: number;
}
export interface RespGeoRadius {
  member: string;
  distance?: number;
  hash?: number;
  position?: RespGeoPosition;
}
export interface RespHashEntry {
  field: string;
  value: string;
}
export interface RespHelloInfo {
  server: string;
  version: string;
  proto: number;
  id: number;
  mode: string;
  role: string;
  modules: RespModuleInfo[];
}
export interface RespLatencyHistogram {
  calls: number;
  histogramUsec: Record<number, number>;
}
export interface RespLatencyHistory {
  timestamp: number;
  latency: number;
}
export interface RespLatencyLatest extends RespLatencyHistory {
  event: string;
  maximumLatency: number;
  sum?: number;
  count?: number;
}
export interface RespLCSMatch {
  a: [number, number];
  b: [number, number];
  length?: number;
}
export interface RespLCSMatches {
  matches: RespLCSMatch[];
  length: number;
}
export interface RespLmpop<Element = string> {
  key: string;
  elements: Element[];
}
export interface RespMemoryStats {
  peak: {
    allocated: number;
    percentage: number;
  };
  total: {
    allocated: number;
  };
  startup: {
    allocated: number;
  };
  replication: {
    backlog: number;
  };
  clients: {
    slaves: number;
    normal: number;
  };
  cluster: {
    links: number;
  };
  aof: {
    buffer: number;
  };
  functions: {
    caches: number;
  };
  db: Record<
    string,
    {
      overhead: {
        hashtable: {
          main: number;
          expires: number;
        };
      };
    }
  >;
  overhead: {
    total: number;
    db: {
      hashtable: {
        lut: number;
        rehashing: number;
      };
    };
  };
  dbDict: {
    rehashingCount: number;
  };
  keys: {
    count: number;
    bytesPerKey: number;
  };
  dataset: {
    bytes: number;
    percentage: number;
  };
  allocator: {
    allocated: number;
    active: number;
    resident: number;
    fragmentation: {
      ratio: number;
      bytes: number;
    };
    rss: {
      ratio: number;
      bytes: number;
    };
  };
  rssOverhead: {
    ratio: number;
    bytes: number;
  };
  fragmentation: number;
  fragmentationBytes: number;
}
export type RespMemoryUsage = number;
export interface RespModuleInfo {
  name: string;
  version: number;
  path?: string;
  arguments?: string[];
}
export interface RespPubsubNumsub {
  [channel: string]: number;
}
export interface RespPubsubShardNumsub {
  [shardChannel: string]: number;
}
export interface RespRoleMaster {
  role: 'master';
  replicationOffset: number;
  slaves: Array<{
    ip: string;
    port: number;
    offset: number;
  }>;
}
export interface RespRoleSlave {
  role: 'slave';
  masterHost: string;
  masterPort: number;
  replicationState: string;
  replicationOffset: number;
}
export interface RespRoleSentinel {
  role: 'sentinel';
  masterNames: string[];
}
export type RespRole = RespRoleMaster | RespRoleSlave | RespRoleSentinel;
export interface RespSlowLogEntry {
  id: number;
  timestamp: number;
  duration: number;
  commandArguments: string[];
  clientIpPort: string;
  clientName: string;
}
export interface RespSortedSetMember {
  member: RespSetMember;
  score: number;
}
export interface RespStreamAutoClaimResult {
  nextId: string;
  entries: RespStreamEntry[];
  deletedIds: string[];
}
export interface RespStreamConsumerInfo {
  name: string;
  pending: number;
  idle: number;
  inactive: number | null;
}
export interface RespStreamConsumerPending {
  id: string;
  deliveryTime: number;
  deliveryCount: number;
}
export interface RespStreamEntry {
  id: string;
  fields: Record<string, string>;
}
export interface RespStreamDeletedEntry {
  id: string;
  fields: null;
}
export interface RespStreamGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lastDeliveredId: string;
  entriesRead: number | null;
  lag: number | null;
}
export interface RespStreamGroupConsumer {
  name: string;
  seenTime: number;
  activeTime: number | null;
  pelCount: number;
  pending: RespStreamConsumerPending[];
}
export interface RespStreamGroupPending {
  id: string;
  consumer: string;
  deliveryTime: number;
  deliveryCount: number;
}
export interface RespStreamGroupDetail {
  name: string;
  lastDeliveredId: string;
  entriesRead: number | null;
  lag: number | null;
  pelCount: number;
  pending: RespStreamGroupPending[];
  consumers: RespStreamGroupConsumer[];
}
export interface RespStreamInfoBase {
  length: number;
  radixTreeKeys: number;
  radixTreeNodes: number;
  lastGeneratedId: string;
  maxDeletedEntryId: string | null;
  entriesAdded: number | null;
  firstEntry: RespStreamEntry | null;
  lastEntry: RespStreamEntry | null;
}
export interface RespStreamInfo extends RespStreamInfoBase {
  groups: number;
}
export interface RespStreamInfoFull extends RespStreamInfoBase {
  recordedFirstEntryId: string | null;
  entries: RespStreamEntry[];
  groups: RespStreamGroupDetail[];
}
export interface RespStreamPendingEntry {
  id: string;
  consumer: string;
  deliveryTime: number;
  deliveryCount: number;
}
export interface RespStreamPendingInfo {
  pending: number;
  minId: string | null;
  maxId: string | null;
  consumers: Array<{
    name: string;
    count: number;
  }>;
}
export interface RespStreamReadResult {
  stream: string;
  entries: RespStreamEntry[];
}
export interface RespStreamGroupReadResult {
  stream: string;
  entries: (RespStreamEntry | RespStreamDeletedEntry)[];
}
export interface RespTimeSeriesInfo {
  totalSamples: number;
  memoryUsage: number;
  firstTimestamp: number;
  lastTimestamp: number;
  retentionTime: number;
  chunkCount: number;
  chunkSize: number;
  chunkType: string;
  duplicatePolicy: string | null;
  labels: Record<string, string>;
  sourceKey: string | null;
  rules: RespTimeSeriesRule[];
  ignoreMaxTimeDiff: number;
  ignoreMaxValDiff: number;
}
export interface RespTimeSeriesRule {
  key: string;
  bucketDuration: number;
  aggregator: string;
  alignment: number;
}
export interface RespWaitAOF {
  localFsynced: number;
  replicasAcknowledged: number;
}
export interface RespConfigInfo {
  [key: string]: string | undefined;
}

export interface RespClientTrackingInfo {
  flags: string[];
  redirect: number;
  prefixes: string[];
}

export class RespPush extends Array<SolidisData> {}
