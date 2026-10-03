import type { SolidisSessionCommandKinds } from '../modules/internal.ts';
import type {
  SolidisData,
  SolidisSubscriptionEventName,
  StringOrBuffer,
} from './solidis.ts';

export type SolidisCommandKind =
  | SolidisSubscriptionEventName
  | (typeof SolidisSessionCommandKinds)[number]
  | 'restricted';

export interface SolidisRequest {
  commands: StringOrBuffer[][];
  kinds: (SolidisCommandKind | undefined)[] | undefined;
  replies: SolidisData[][];
  resolve: (replies: SolidisData[][]) => void;
  reject: (reason: unknown) => void;
  timeout: number;
  isBlocking: boolean;
}

export interface SolidisSubRequest {
  request: SolidisRequest;
  command: StringOrBuffer[];
  kind: SolidisCommandKind | undefined;
  span: number;
  index: number;
}

export interface SolidisPipeline {
  commands: StringOrBuffer[][];
  subRequests: SolidisSubRequest[];
  subRequestIndex: number;
  subReplies: SolidisData[];
  timeout: number;
  timer: NodeJS.Timeout | undefined;
  isBlocking: boolean;
  isTimedOut: boolean;
}
