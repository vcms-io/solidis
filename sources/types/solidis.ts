import type net from 'node:net';
import type tls from 'node:tls';
import type { SolidisClient } from '../client.ts';
import type { RespError } from '../common/utils/error.ts';
import type { SolidisConnection } from '../modules/connection.ts';
import type { SolidisDebugMemory } from '../modules/debug.ts';
import type { SolidisPubSub } from '../modules/pubsub.ts';

export type StringOrBuffer = string | Buffer;

export type SolidisData =
  | string
  | number
  | null
  | Buffer
  | boolean
  | bigint
  | RespError
  | SolidisData[]
  | Map<string, SolidisData>
  | Set<SolidisData>;

export type SolidisRecursiveStringRecord = {
  [key: string]: string | undefined | SolidisRecursiveStringRecord;
};

export const SolidisProtocols = {
  RESP2: 'RESP2',
  RESP3: 'RESP3',
} as const;
export type SolidisProtocols = keyof typeof SolidisProtocols;

export interface SolidisClientOptions {
  authentication?: {
    username?: string;
    password?: string;
  };
  autoReconnect?: boolean;
  autoRecovery?: {
    database?: boolean;
    subscribe?: boolean;
    ssubscribe?: boolean;
    psubscribe?: boolean;
  };
  clientName?: string;
  commandTimeout?: number;
  connectionTimeout?: number;
  connectionRetryDelay?: number;
  database?: number;
  debug?: boolean;
  debugMaxEntries?: number;
  enableReadyCheck?: boolean;
  host?: string;
  uri?: string | URL | false;
  lazyConnect?: boolean;
  maxConnectionRetries?: number;
  maxCommandsPerPipeline?: number;
  maxEventListenersForClient?: number;
  maxEventListenersForSocket?: number;
  maxProcessRepliesPerChunk?: number;
  maxSocketWriteSizePerOnce?: number;
  parser?: {
    buffer: {
      initial: number;
      shiftThreshold: number;
    };
  };
  port?: number;
  protocol?: SolidisProtocols;
  readyCheckInterval?: number;
  rejectOnPartialPipelineError?: boolean;
  socketWriteTimeout?: number;
  useTLS?: boolean;
}

export type SolidisClientFrozenOptions = Readonly<
  Required<SolidisClientOptions>
>;

export type SolidisConnectionOptions = SolidisClientFrozenOptions & {
  debugMemory?: SolidisDebugMemory;
};

export type SolidisRequesterOptions = SolidisClientFrozenOptions & {
  connection: SolidisConnection;
  pubSub: SolidisPubSub;
  debugMemory?: SolidisDebugMemory;
};

export type SolidisSocket = net.Socket | tls.TLSSocket;

export type SolidisSubRequestResolveHandler = (value: SolidisData[]) => void;
export type SolidisRequestResolveHandler = (value: SolidisData[][]) => void;
export type SolidisRejectHandler = (reason?: unknown) => void;

export type SolidisRespLengthType =
  | 'Bulk'
  | 'BlobError'
  | 'Array'
  | 'Push'
  | 'Map'
  | 'Set'
  | 'VerbatimString';
export type SolidisRespSimpleLineType =
  | 'SimpleString'
  | 'Error'
  | 'Double'
  | 'BigNumber';
export type SolidisRespPrimitiveType = 'Integer' | 'Boolean' | 'Null';
export type SolidisRespType =
  | SolidisRespLengthType
  | SolidisRespSimpleLineType
  | SolidisRespPrimitiveType;

export type SolidisParsed<T = SolidisData> = {
  data: T | null;
  length: number;
  ignore?: boolean;
} | null;
export type SolidisParsedBufferWithLength =
  | (Omit<NonNullable<SolidisParsed>, 'data'> & {
      data: Buffer | null;
    })
  | null;

export interface SolidisParseRequest {
  resolve: (value: SolidisData[]) => void;
  reject: (reason?: unknown) => void;
}

export interface SolidisRequest {
  commands: StringOrBuffer[][];
  resolve: SolidisRequestResolveHandler;
  reject: SolidisRejectHandler;
  replies: SolidisData[][];
}

export interface SolidisPipelineSubRequest {
  cursor: number;
  resolve: SolidisSubRequestResolveHandler;
  reject: SolidisRejectHandler;
}

export interface SolidisPipelineRequest {
  sessionId: number;
  resolve: SolidisRequestResolveHandler;
  reject: SolidisRejectHandler;
  commandsBuffer: Buffer;
  parsedReplies: SolidisData[];
  expectedReplyCount: number;
  subRequests: SolidisPipelineSubRequest[];
  timeoutId?: NodeJS.Timeout;
}

export interface SolidisPipelineRequestChunk {
  pipelinedCommands: StringOrBuffer[][];
  subRequests: SolidisPipelineSubRequest[];
}

export interface SolidisPipelineRequestChunkContext {
  cursor: number;
  chunks: SolidisPipelineRequestChunk[];
  pipelinedCommands: StringOrBuffer[][];
  subRequests: SolidisPipelineSubRequest[];
}

export interface SolidisSubscribeEvents {
  subscribe: (channel: string, count: number) => void;
  ssubscribe: (channel: string, count: number) => void;
  psubscribe: (pattern: string, count: number) => void;
  unsubscribe: (channel: string, count: number) => void;
  sunsubscribe: (channel: string, count: number) => void;
  punsubscribe: (pattern: string, count: number) => void;
}

export interface SolidisPubSubEvents extends SolidisSubscribeEvents {
  message: (channel: string, message: StringOrBuffer) => void;
  pmessage: (pattern: string, channel: string, message: StringOrBuffer) => void;
}

export type SolidisTranslatedPubSubReplies = [
  string | null,
  string | null,
  number | string | null,
  string | null,
];

export interface SolidisClientEvents extends SolidisPubSubEvents {
  connect: () => void;
  ready: () => void;
  error: (error: Error) => void;
  end: () => void;
  drain: () => void;
  close: () => void;
  debug: (entry: SolidisDebugLog) => void;
}

export interface SolidisClientEventHandlers<T = SolidisClient> {
  emit: <E extends keyof SolidisClientEvents>(
    event: E,
    ...parameters: Parameters<SolidisClientEvents[E]>
  ) => boolean;
  on: <E extends keyof SolidisClientEvents>(
    event: E,
    listener: SolidisClientEvents[E],
  ) => T;
  once: <E extends keyof SolidisClientEvents>(
    event: E,
    listener: SolidisClientEvents[E],
  ) => T;
}

export type SolidisClientRecoveryStep<
  T extends (...parameters: Parameters<T>) => Promise<unknown>,
> = {
  condition: boolean;
  method: T | undefined;
  methodName: string;
  parameters: Parameters<T>;
};

export interface SolidisConnectionEvents {
  connect: () => void;
  error: (error: Error) => void;
  close: () => void;
  end: () => void;
  closed: (error: Error) => void;
  reconnected: () => void;
}

export interface SolidisConnectionEventHandlers<T = SolidisConnection> {
  emit: <E extends keyof SolidisConnectionEvents>(
    event: E,
    ...parameters: Parameters<SolidisConnectionEvents[E]>
  ) => boolean;
  on: <E extends keyof SolidisConnectionEvents>(
    event: E,
    listener: SolidisConnectionEvents[E],
  ) => T;
}

export type SolidisDebugEvents = {
  pushed: (entry: SolidisDebugLog) => void;
  close: () => void;
  drain: () => void;
  error: (err: Error) => void;
  finish: () => void;
  pipe: (src: NodeJS.ReadableStream) => void;
  unpipe: (src: NodeJS.ReadableStream) => void;
};

export interface SolidisDebugMemoryEventHandlers<T = SolidisDebugMemory> {
  write(
    chunk: SolidisDebugLog,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;
  write(
    chunk: SolidisDebugLog,
    encoding: BufferEncoding,
    callback?: (error: Error | null | undefined) => void,
  ): boolean;
  emit<E extends keyof SolidisDebugEvents>(
    event: E,
    ...parameters: Parameters<SolidisDebugEvents[E]>
  ): boolean;
  on<E extends keyof SolidisDebugEvents>(
    event: E,
    listener: SolidisDebugEvents[E],
  ): T;
}

export interface SolidisSocketWriteEventHandlers {
  onError: (error: Error) => void;
  waitForDrain: () => Promise<void>;
  removeEventListeners: () => void;
  isError: boolean;
  error: Error | null;
}

export type SolidisDebugLogType = 'error' | 'info' | 'debug' | 'warn';

export interface SolidisDebugLog {
  timestamp?: number;
  type: SolidisDebugLogType;
  message: string;
  data?: unknown;
}

export type SolidisTransactionMethod<T> = T extends (
  ...parameters: infer Parameters
) => unknown
  ? (...parameters: Parameters) => void
  : T;

export type SolidisTransactionBannedMethods =
  | 'multi'
  | 'pipeline'
  | 'watch'
  | 'unwatch'
  | 'subscribe'
  | 'ssubscribe'
  | 'psubscribe'
  | 'unsubscribe'
  | 'sunsubscribe'
  | 'punsubscribe'
  | 'auth'
  | 'hello';

export type SolidisTransactionClient<T> = {
  [K in keyof T as K extends SolidisTransactionBannedMethods
    ? never
    : K]: SolidisTransactionMethod<T[K]>;
} & {
  exec(): Promise<SolidisData[]>;
  discard(): void;
};

export type SolidisClientExtensions<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  [K in keyof T]: K extends 'multi'
    ? T[K] extends (...parameters: infer Parameters) => unknown
      ? (...parameters: Parameters) => SolidisTransactionClient<T>
      : T[K]
    : T[K] extends (...parameters: infer Parameters) => infer R
      ? (...parameters: Parameters) => R
      : T[K];
};

export type SolidisSubscribeMethod = (
  ...channels: string[]
) => Promise<unknown>;

export type SolidisSSubscribeMethod = (
  ...channels: string[]
) => Promise<unknown>;

export type SolidisPSubscribeMethod = (
  ...patterns: string[]
) => Promise<unknown>;
