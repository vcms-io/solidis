import type { EventEmitter, errorMonitor } from 'node:events';
import type { Socket } from 'node:net';
import type { ConnectionOptions, TLSSocket } from 'node:tls';
import type { SolidisClient } from '../client.ts';
import type {
  SolidisTransactionBannedCommandNames,
  SolidisUnsubscribeEventNames,
} from '../common/constants.ts';
import type { RespError } from '../common/utils/error.ts';
import type { SolidisConnection } from '../modules/connection.ts';
import type { SolidisPubSub } from '../modules/pubsub.ts';
import type { RespPush } from './resp.ts';

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

export const SolidisProtocols = {
  RESP2: 'RESP2',
  RESP3: 'RESP3',
} as const;
export type SolidisProtocols = keyof typeof SolidisProtocols;

type DeepRequired<T> = {
  [P in keyof T]-?: NonNullable<T[P]> extends object
    ? DeepRequired<NonNullable<T[P]>>
    : NonNullable<T[P]>;
};

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
  enableReadyCheck?: boolean;
  host?: string;
  uri?: string | URL | false;
  lazyConnect?: boolean;
  maxConnectionRetries?: number;
  maxConnectionRetryDelay?: number;
  maxCommandsPerPipeline?: number;
  maxEventListenersForClient?: number;
  parser?: {
    maxBulkStringLength?: number;
  };
  port?: number;
  protocol?: SolidisProtocols;
  readyCheckInterval?: number;
  maxReadyCheckRetries?: number;
  rejectOnPartialPipelineError?: boolean;
  tls?: ConnectionOptions;
}

export type SolidisClientFrozenOptions = Readonly<
  DeepRequired<Omit<SolidisClientOptions, 'tls'>> & {
    tls?: ConnectionOptions;
  }
>;

export type SolidisConnectionOptions = SolidisClientFrozenOptions & {
  debugHandle?: SolidisDebugHandle;
};

export type SolidisParserOptions = Pick<SolidisClientFrozenOptions, 'parser'>;

export type SolidisSocket = Socket | TLSSocket;

export type SolidisClientEmit = SolidisClientEventHandlers['emit'];

export type SolidisRequesterOptions = SolidisClientFrozenOptions & {
  connection: SolidisConnection;
  pubSub: SolidisPubSub;
  emit: SolidisClientEmit;
  debugHandle?: SolidisDebugHandle;
};

export interface SolidisSendOptions {
  timeout?: number;
  blockingTimeout?: number;
}

export type SolidisMessageEventName = 'message' | 'pmessage' | 'smessage';

export type SolidisSubscriptionEventName = keyof SolidisSubscribeEvents;

export type SolidisUnsubscribeEventName =
  (typeof SolidisUnsubscribeEventNames)[number];

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
  smessage: (channel: string, message: StringOrBuffer) => void;
  pmessage: (pattern: string, channel: string, message: StringOrBuffer) => void;
}

export interface SolidisClientEvents extends SolidisPubSubEvents {
  connect: () => void;
  ready: () => void;
  reconnecting: (attempt: number, delay: number) => void;
  reconnected: () => void;
  close: (error: Error) => void;
  end: () => void;
  error: (error: Error) => void;
  drain: () => void;
  push: (reply: RespPush) => void;
  debug: (entry: SolidisDebugLog) => void;
}

export interface SolidisClientEventHandlers<T = SolidisClient> {
  emit: <E extends keyof SolidisClientEvents>(
    event: E,
    ...parameters: Parameters<SolidisClientEvents[E]>
  ) => boolean;
  on: {
    <E extends keyof SolidisClientEvents>(
      event: E,
      listener: SolidisClientEvents[E],
    ): T;
    (event: typeof errorMonitor, listener: SolidisClientEvents['error']): T;
  };
  once: SolidisClientEventHandlers<T>['on'];
}

export interface SolidisConnectionEvents {
  connect: () => void;
  data: (chunk: Buffer) => void;
  drain: () => void;
  close: (error: Error) => void;
  reconnecting: (attempt: number, delay: number) => void;
  error: (error: Error) => void;
  end: () => void;
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

export type SolidisDebugLogType = 'error' | 'info' | 'debug' | 'warn';

export type SolidisDebugHandle = (
  type: SolidisDebugLogType,
  message: string,
  data?: unknown,
) => void;

export interface SolidisDebugLog {
  timestamp: number;
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
  | (typeof SolidisTransactionBannedCommandNames)[number]
  | 'connect'
  | 'quit'
  | 'send'
  | 'extend'
  | keyof EventEmitter;

type SolidisFunction = (...parameters: never[]) => unknown;

declare const SolidisTransactionBrand: unique symbol;

export type SolidisTransactionClient<T> = {
  [K in keyof T as K extends SolidisTransactionBannedMethods
    ? never
    : T[K] extends (...parameters: never[]) => AsyncIterable<unknown>
      ? never
      : T[K] extends SolidisFunction
        ? K
        : never]: SolidisTransactionMethod<T[K]>;
} & {
  exec(): Promise<SolidisData[] | null>;
  discard(): void;
  readonly [SolidisTransactionBrand]: true;
};

export type SolidisClientExtensions<
  T extends object = Record<string, unknown>,
  C = unknown,
> = {
  [K in keyof T as K extends symbol | 'constructor' | '__proto__'
    ? never
    : T[K] extends SolidisFunction
      ? K
      : never]: T[K] extends (
    ...parameters: infer Parameters
  ) => Pick<SolidisTransactionClient<unknown>, typeof SolidisTransactionBrand>
    ? (
        ...parameters: Parameters
      ) => SolidisTransactionClient<C & SolidisClientExtensions<Omit<T, K>>>
    : OmitThisParameter<T[K]>;
};
