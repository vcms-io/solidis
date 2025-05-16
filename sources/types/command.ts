import type {
  RespBitfield,
  RespDataTypes,
  RespDuplicatePolicy,
  RespEncoding,
} from './resp.ts';

export type CommandBitOrByteOption = 'BIT' | 'BYTE';
export type CommandLeftOrRightOption = 'LEFT' | 'RIGHT';
export type CommandMinOrMaxOption = 'MIN' | 'MAX';
export type CommandAggregateOption = 'SUM' | CommandMinOrMaxOption;
export type CommandGeoUnitOption = 'M' | 'KM' | 'FT' | 'MI';
export type CommandBeforeOrAfterOption = 'BEFORE' | 'AFTER';
export type CommandExpireMode = 'NX' | 'XX' | 'GT' | 'LT';

export interface CommandBloomFilterInsertOptions {
  capacity?: number;
  error?: number;
  expansion?: number;
  nonScaling?: boolean;
  nocreate?: boolean;
}

export interface CommandBitfieldGetOperationOption {
  operation: 'GET';
  type: RespBitfield;
  offset: number;
}

export interface CommandBitfieldRoGetOperationOption {
  type: RespBitfield;
  offset: number;
}

export interface CommandBitfieldSetOperationOption {
  operation: 'SET';
  type: RespBitfield;
  offset: number;
  value: number;
}

export interface CommandBitfieldIncrbyOperationOption {
  operation: 'INCRBY';
  type: RespBitfield;
  offset: number;
  increment: number;
}

export type CommandBitfieldOperationOption =
  | CommandBitfieldGetOperationOption
  | CommandBitfieldSetOperationOption
  | CommandBitfieldIncrbyOperationOption;

export interface CommandClientListOptions {
  type?: 'NORMAL' | 'MASTER' | 'REPLICA' | 'PUBSUB';
  identifiers?: number[];
}

export interface CommandClientPauseOptions {
  mode?: 'WRITE' | 'ALL';
}

export interface CommandClientTrackingOptions {
  redirect?: number;
  prefixes?: string[];
  bcast?: boolean;
  optin?: boolean;
  optout?: boolean;
  noloop?: boolean;
}

export interface CommandClientUnblockOptions {
  timeout?: boolean;
  error?: boolean;
}

export interface CommandCopyOptions {
  destinationDatabase?: number;
  replace?: boolean;
}

export interface CommandCuckooFilterInsertOptions {
  capacity?: number;
  nocreate?: boolean;
}

export interface CommandFailoverOptions {
  to?: {
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
  force?: boolean;
  abort?: boolean;
  timeout?: number;
}

export interface CommandFunctionListOptions {
  libraryNamePattern?: string;
  withCode?: boolean;
}

export interface CommandFunctionRestoreOptions {
  replace?: boolean;
  flush?: boolean;
  append?: boolean;
}

export interface CommandGeoAddMemberOption {
  longitude: number;
  latitude: number;
  member: string;
}

export interface CommandGeoAddOptions {
  nx?: boolean;
  xx?: boolean;
  ch?: boolean;
}

export interface CommandGeoSearchOptions {
  unit?: CommandGeoUnitOption;
  withCoord?: boolean;
  withDist?: boolean;
  withHash?: boolean;
  count?: number;
  any?: boolean;
  asc?: boolean;
  desc?: boolean;
}

export interface CommandGeoRadiusOptions extends CommandGeoSearchOptions {
  store?: string;
  storedist?: string;
}

export interface CommandGeoSearchByOptions {
  bybox?: {
    width: number;
    height: number;
    unit: CommandGeoUnitOption;
  };
  byradius?: {
    radius: number;
    unit: CommandGeoUnitOption;
  };
}

export interface CommandGeoSearchFromOptions {
  frommember?: string;
  fromlonlat?: {
    longitude: number;
    latitude: number;
  };
}
export interface CommandGeoSearchStoreOptions
  extends Omit<CommandGeoSearchOptions, 'withCoord' | 'withDist' | 'withHash'> {
  storedist?: boolean;
}

export interface CommandGetExOptions {
  expireInSeconds?: number;
  expireInMilliseconds?: number;
  expireAtSeconds?: number;
  expireAtMilliseconds?: number;
  persist?: boolean;
}

export interface CommandJsonSetOptions {
  nx?: boolean;
  xx?: boolean;
}

export interface CommandJsonGetOptions {
  indent?: string;
  newline?: string;
  space?: string;
  path?: string[];
}

export interface CommandJsonArrIndexOptions {
  start?: number;
  stop?: number;
}

export interface CommandJsonArrTrimOptions {
  start: number;
  stop: number;
}

export interface CommandLCSOptions {
  len?: boolean;
  idx?: boolean;
  minmatchlen?: number;
  withmatchlen?: boolean;
}

export interface CommandLposOptions {
  rank?: number;
  count?: number;
  maxlen?: number;
}

export interface CommandLimitOptions {
  offset: number;
  count: number;
}

export interface CommandLimitWithScoresOptions {
  limit: CommandLimitOptions;
  withScores: true;
}

export interface CommandMigrateOptions {
  copy?: boolean;
  replace?: boolean;
  auth?: string;
  auth2?: {
    username: string;
    password: string;
  };
  keys?: string[];
}

export interface CommandRestoreOptions {
  replace?: boolean;
  absttl?: boolean;
  idletime?: number;
  freq?: number;
}

export interface CommandScanBaseOptions {
  count?: number;
  match?: string;
}

export interface CommandScanOptions extends CommandScanBaseOptions {
  type?: RespDataTypes;
}

export interface CommandScriptFlushOptions {
  sync?: boolean;
  async?: boolean;
}

export interface CommandSetOptions {
  expireInSeconds?: number;
  expireInMilliseconds?: number;
  expireAtSeconds?: number;
  expireAtMilliseconds?: number;
  keepOriginalTimeToLive?: boolean;
  setIfKeyNotExists?: boolean;
  setIfKeyExists?: boolean;
  returnOldValue?: boolean;
  returnOldValueAsBuffer?: boolean;
}

export interface CommandShutdownOptions {
  nosave?: boolean;
  save?: boolean;
  now?: boolean;
  force?: boolean;
  abort?: boolean;
}

export interface CommandSortOptions {
  by?: string;
  limit?: CommandLimitOptions;
  get?: string[];
  order?: 'ASC' | 'DESC';
  alpha?: boolean;
}

export interface CommandSortStoreOptions extends CommandSortOptions {
  store: string;
}

export interface CommandStartToEndAndBitOrByteOptions {
  start?: number;
  end?: number;
  mode?: CommandBitOrByteOption;
}

export interface CommandTimeSeriesOptions {
  retention?: number;
  encoding?: RespEncoding;
  chunkSize?: number;
  duplicatePolicy?: RespDuplicatePolicy;
  onDuplicate?: RespDuplicatePolicy;
  ignore?: {
    maxTimediff: number;
    maxValDiff: number;
  };
  labels?: Record<string, string>;
}

export type CommandTimeSeriesCreateOptions = Omit<
  CommandTimeSeriesOptions,
  'timestamp' | 'value' | 'onDuplicate'
>;

export type CommandTimeSeriesAlterOptions = Omit<
  CommandTimeSeriesOptions,
  'timestamp' | 'value' | 'onDuplicate' | 'encoding'
>;

export type CommandTimeSeriesAddOptions = Omit<
  CommandTimeSeriesOptions,
  'timestamp' | 'value'
>;

export type CommandTimeSeriesIncrDecrOptions = Omit<
  CommandTimeSeriesOptions,
  'onDuplicate'
>;

export interface CommandTimeSeriesCreateRuleOptions {
  aggregation: {
    type: string;
    bucketDuration: number;
    alignTimestamp?: number;
  };
}

export interface CommandTimeSeriesRangeOptions {
  filterByTs?: [number, number][];
  filterByValue?: [number, number][];
  count?: number;
  align?: number;
  aggregation?: {
    type: string;
    bucketDuration: number;
  };
  latest?: boolean;
}

export interface CommandTimeSeriesMGetOptions {
  latest?: boolean;
  filterByValue?: [number, number][];
}

export interface CommandZInterOptions {
  weights?: number[];
  aggregate?: CommandAggregateOption;
}

export interface CommandZInterWithScoreOptions extends CommandZInterOptions {
  withScores?: boolean;
}

export interface CommandZRangeStoreOptions {
  byScore?: boolean;
  byLex?: boolean;
  reverse?: boolean;
  limit?: CommandLimitOptions;
}

export interface CommandZRangeOptions extends CommandZRangeStoreOptions {
  withScores?: boolean;
}
