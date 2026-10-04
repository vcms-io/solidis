import type {
  RespBitfield,
  RespDataTypes,
  RespDuplicatePolicy,
  RespEncoding,
} from './resp.ts';
import type { SolidisProtocols, StringOrBuffer } from './solidis.ts';

export type CommandBitOrByteOption = 'BIT' | 'BYTE';
export type CommandLeftOrRightOption = 'LEFT' | 'RIGHT';
export type CommandMinOrMaxOption = 'MIN' | 'MAX';
export type CommandAggregateOption = 'SUM' | CommandMinOrMaxOption;
export type CommandGeoUnitOption = 'M' | 'KM' | 'FT' | 'MI';
export type CommandBeforeOrAfterOption = 'BEFORE' | 'AFTER';
export type CommandExpireMode = 'NX' | 'XX' | 'GT' | 'LT';

type CommandOptionKeys<Options> = Options extends unknown
  ? keyof Options
  : never;

type CommandOptionValues<Options, Key> = Options extends unknown
  ? Key extends keyof Options
    ? Options[Key]
    : never
  : never;

type CommandExclusiveAlternatives<Options, Alternatives> =
  Options extends unknown
    ? Options & {
        [Key in Exclude<
          CommandOptionKeys<Alternatives>,
          keyof Options
        >]?: CommandOptionValues<Alternatives, Key> extends boolean | undefined
          ? false
          : never;
      }
    : never;

export type CommandExclusiveOptions<Alternatives> =
  CommandExclusiveAlternatives<Alternatives, Alternatives>;

export type CommandExactOptions<Options, Shape> = {
  [Key in Exclude<keyof Options, CommandOptionKeys<Shape>>]: never;
};

type CommandExpireAlternatives =
  | { expireInSeconds?: number }
  | { expireInMilliseconds?: number }
  | { expireAtSeconds?: number }
  | { expireAtMilliseconds?: number };

export type CommandBloomFilterInsertOptions = CommandExclusiveOptions<
  { capacity?: number; error?: number } | { nocreate?: boolean }
> & {
  expansion?: number;
  nonScaling?: boolean;
};

export type CommandBitfieldOffset = number | `#${number}`;

export interface CommandBitfieldGetOperationOption {
  operation: 'GET';
  type: RespBitfield;
  offset: CommandBitfieldOffset;
}

export interface CommandBitfieldRoGetOperationOption {
  type: RespBitfield;
  offset: CommandBitfieldOffset;
}

export interface CommandBitfieldSetOperationOption {
  operation: 'SET';
  type: RespBitfield;
  offset: CommandBitfieldOffset;
  value: number | bigint;
}

export interface CommandBitfieldIncrbyOperationOption {
  operation: 'INCRBY';
  type: RespBitfield;
  offset: CommandBitfieldOffset;
  increment: number | bigint;
}

export type CommandBitfieldOperationOption =
  | CommandBitfieldGetOperationOption
  | CommandBitfieldSetOperationOption
  | CommandBitfieldIncrbyOperationOption;

export type CommandClientListOptions = CommandExclusiveOptions<
  | { type?: 'NORMAL' | 'MASTER' | 'REPLICA' | 'PUBSUB' }
  | { identifiers?: number[] }
>;

export interface CommandClientPauseOptions {
  mode?: 'WRITE' | 'ALL';
}

export type CommandClientTrackingOptions = CommandExclusiveOptions<
  | { bcast: true; prefixes?: string[] }
  | { optin?: boolean }
  | { optout?: boolean }
> & {
  redirect?: number;
  noloop?: boolean;
};

export type CommandClientUnblockOptions = CommandExclusiveOptions<
  { timeout?: boolean } | { error?: boolean }
>;

export interface CommandBufferOptions {
  buffer?: boolean;
}

export interface CommandCopyOptions {
  destinationDatabase?: number;
  replace?: boolean;
}

export type CommandCuckooFilterInsertOptions = CommandExclusiveOptions<
  { capacity?: number } | { nocreate?: boolean }
>;

export type CommandDelExOptions = CommandExclusiveOptions<
  | { ifValueEquals?: StringOrBuffer }
  | { ifValueNotEquals?: StringOrBuffer }
  | { ifDigestEquals?: string }
  | { ifDigestNotEquals?: string }
>;

interface CommandFailoverTarget {
  host: string;
  port: number;
}

export type CommandFailoverOptions = CommandExclusiveOptions<
  | { to?: CommandFailoverTarget; timeout?: number; force?: false }
  | { to: CommandFailoverTarget; timeout: number; force: true }
  | { abort?: boolean }
>;

export interface CommandFunctionListOptions {
  libraryNamePattern?: string;
  withCode?: boolean;
}

export type CommandFunctionRestoreOptions = CommandExclusiveOptions<
  { replace?: boolean } | { flush?: boolean } | { append?: boolean }
>;

export interface CommandGeoAddMemberOption {
  longitude: number;
  latitude: number;
  member: string;
}

export type CommandGeoAddOptions = CommandExclusiveOptions<
  { nx?: boolean } | { xx?: boolean }
> & {
  ch?: boolean;
};

type CommandGeoOrderOptions = CommandExclusiveOptions<
  { asc?: boolean } | { desc?: boolean }
>;

type CommandGeoCountOptions =
  | { count?: number; any?: false }
  | { count: number; any: true };

export type CommandGeoSearchOptions = CommandGeoOrderOptions &
  CommandGeoCountOptions & {
    withCoord?: boolean;
    withDist?: boolean;
    withHash?: boolean;
  };

export type CommandGeoRadiusOptions = CommandGeoOrderOptions &
  CommandGeoCountOptions &
  CommandExclusiveOptions<
    | { withCoord?: boolean; withDist?: boolean; withHash?: boolean }
    | { store: string }
    | { storedist: string }
  >;

export type CommandGeoSearchByOptions = CommandExclusiveOptions<
  | {
      bybox: {
        width: number;
        height: number;
        unit: CommandGeoUnitOption;
      };
    }
  | {
      byradius: {
        radius: number;
        unit: CommandGeoUnitOption;
      };
    }
>;

export type CommandGeoSearchFromOptions = CommandExclusiveOptions<
  | { frommember: string }
  | {
      fromlonlat: {
        longitude: number;
        latitude: number;
      };
    }
>;

export type CommandGeoSearchStoreOptions = CommandGeoOrderOptions &
  CommandGeoCountOptions & {
    storedist?: boolean;
  };

export type CommandGetExOptions = CommandExclusiveOptions<
  CommandExpireAlternatives | { persist?: boolean }
> &
  CommandBufferOptions;

export interface CommandIntegerOptions {
  bigint?: boolean;
}

export type CommandJsonSetOptions = CommandExclusiveOptions<
  { nx?: boolean } | { xx?: boolean }
>;

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

export type CommandLCSOptions = CommandExclusiveOptions<
  { len?: boolean } | { idx?: boolean }
> & {
  minmatchlen?: number;
  withmatchlen?: boolean;
};

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
  limit?: CommandLimitOptions;
  withScores?: boolean;
}

export type CommandTimeSeriesTimestamp = number | '-' | '+';

export type CommandTimeSeriesSampleTimestamp = number | '*';

export type CommandScoreBound = number | '-inf' | '+inf' | `(${number}`;

export type CommandMigrateOptions = CommandExclusiveOptions<
  | { auth?: string }
  | {
      auth2?: {
        username: string;
        password: string;
      };
    }
> & {
  copy?: boolean;
  replace?: boolean;
  keys?: string[];
};

export type CommandRestoreOptions = CommandExclusiveOptions<
  { idletime?: number } | { freq?: number }
> & {
  replace?: boolean;
  absttl?: boolean;
};

export interface CommandScanBaseOptions {
  count?: number;
  match?: string;
}

export interface CommandScanOptions extends CommandScanBaseOptions {
  type?: RespDataTypes | (string & Record<never, never>);
}

export type CommandScriptFlushOptions = CommandExclusiveOptions<
  { sync?: boolean } | { async?: boolean }
>;

export type CommandSetOptions = CommandExclusiveOptions<
  CommandExpireAlternatives | { keepOriginalTimeToLive?: boolean }
> &
  CommandExclusiveOptions<
    | { setIfKeyNotExists?: boolean }
    | { setIfKeyExists?: boolean }
    | { setIfValueEquals?: StringOrBuffer }
    | { setIfValueNotEquals?: StringOrBuffer }
    | { setIfDigestEquals?: string }
    | { setIfDigestNotEquals?: string }
  > &
  (
    | { returnOldValue: true; returnOldValueAsBuffer?: boolean }
    | { returnOldValue?: boolean; returnOldValueAsBuffer?: never }
  );

export type CommandShutdownOptions = CommandExclusiveOptions<
  | { nosave?: boolean; now?: boolean; force?: boolean }
  | { save?: boolean; now?: boolean; force?: boolean }
  | { abort?: boolean }
>;

export interface CommandSortOptions {
  by?: string;
  limit?: CommandLimitOptions;
  get?: string[];
  order?: 'ASC' | 'DESC';
  alpha?: boolean;
  store?: never;
}

export interface CommandSortStoreOptions
  extends Omit<CommandSortOptions, 'store'> {
  store: string;
}

export type CommandHelloParameters =
  | []
  | [
      protocol: SolidisProtocols,
      username?: undefined,
      password?: undefined,
      clientName?: string,
    ]
  | [
      protocol: SolidisProtocols,
      username: StringOrBuffer | undefined,
      password: StringOrBuffer,
      clientName?: string,
    ];

export type CommandXpendingRange = [
  start: string,
  end: string,
  count: number,
  consumer?: string,
  idleTime?: number,
];

export type CommandBitposOptions =
  | { start?: number; end?: undefined; mode?: undefined }
  | { start?: number; end: number; mode?: CommandBitOrByteOption };

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
> & {
  timestamp?: CommandTimeSeriesSampleTimestamp;
};

export interface CommandTimeSeriesCreateRuleOptions {
  aggregation: {
    type: string;
    bucketDuration: number;
    alignTimestamp?: number;
  };
}

interface CommandTimeSeriesRangeAggregation {
  type: string;
  bucketDuration: number;
}

export type CommandTimeSeriesRangeOptions = {
  filterByTs?: number[];
  filterByValue?: [number, number];
  count?: number;
  latest?: boolean;
} & (
  | { aggregation?: CommandTimeSeriesRangeAggregation; align?: undefined }
  | {
      aggregation: CommandTimeSeriesRangeAggregation;
      align?: CommandTimeSeriesTimestamp | 'start' | 'end';
    }
);

export interface CommandTimeSeriesMGetOptions {
  latest?: boolean;
}

export interface XclaimOptions {
  idle?: number;
  time?: number;
  retrycount?: number;
  force?: boolean;
  justid?: boolean;
}

export interface CommandZInterOptions {
  weights?: number[];
  aggregate?: CommandAggregateOption;
}

export interface CommandZInterWithScoreOptions extends CommandZInterOptions {
  withScores?: boolean;
}

export type CommandZRangeStoreOptions = CommandExclusiveOptions<
  | { byScore: true; limit?: CommandLimitOptions }
  | { byLex: true; limit?: CommandLimitOptions }
  | { byScore?: false; byLex?: false }
> & {
  reverse?: boolean;
};

export type CommandZRangeOptions = CommandExclusiveOptions<
  | { byScore: true; limit?: CommandLimitOptions; withScores?: boolean }
  | { byLex: true; limit?: CommandLimitOptions }
  | { byScore?: false; byLex?: false; withScores?: boolean }
> & {
  reverse?: boolean;
};
