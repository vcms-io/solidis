import type { SolidisSessionCommandKinds } from '../common/internal.ts';
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

export interface SolidisPipelineDraft {
  commands: StringOrBuffer[][];
  subRequests: SolidisSubRequest[];
  timeout: number;
  isBlocking: boolean;
}

export interface SolidisPipeline {
  subRequests: SolidisSubRequest[];
  subRequestIndex: number;
  subReplies: SolidisData[];
  timer: NodeJS.Timeout | undefined;
  isBlocking: boolean;
  isTimedOut: boolean;
}
