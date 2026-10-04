export type LibraryName = string;
export type BenchmarkMode = 'autopipeline' | 'batch';
export type BenchmarkNote =
  | { kind: 'resp3PubSub' | 'atomicTransactions' | 'batchedOperations' }
  | { kind: 'noAutoPipeline'; commands: string[] };
export type SerializedBenchConfig = Omit<
  BenchConfig,
  'operations' | 'libraries'
> & {
  operations?: string[];
  libraries?: string[];
};
export interface BenchWorkerData {
  config: SerializedBenchConfig;
  benchmarkCaseName: string;
  library: LibraryName;
  payloadBytes: number;
  caseIndex: number;
  sampleIndex: number;
}
export type CommandArgument = string | Buffer;
export type Command = CommandArgument[];

export interface ConnectionTarget {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface BenchConfig {
  target: ConnectionTarget;
  mode: BenchmarkMode;
  sizes: number[];
  iterations: number;
  warmup: number;
  clients: number;
  concurrency: number;
  repeats: number;
  cooldownMs: number;
  operations?: Set<string>;
  libraries?: Set<string>;
}

export interface BenchContext {
  config: BenchConfig;
  library: LibraryName;
  payloadBytes: number;
  payloadPool: PayloadPool;
  clients?: BenchClient[];
  keyPrefix: string;
}

export interface BenchResult {
  operation: string;
  library: LibraryName;
  mode: BenchmarkMode;
  payloadBytes: number;
  iterations: number;
  clients: number;
  concurrency: number;
  totalConcurrency: number;
  commandsPerUnit: number;
  elapsedMs: number | null;
  spreadPercent: number | null;
  latencyPercentile50Milliseconds?: number;
  latencyPercentile95Milliseconds?: number;
  latencyPercentile99Milliseconds?: number;
  latencyPercentile999Milliseconds?: number;
  cpuMicrosecondsPerUnit?: number;
  gcMicrosecondsPerUnit?: number;
  peakMemoryBytes?: number;
  unitsPerSecond: number | null;
  commandsPerSecond: number | null;
  samplesMs: number[];
  caseWallMs?: number;
  comparable: boolean;
  nonComparableReason?: BenchmarkNote;
  verificationError?: string;
  error?: string;
}

export interface LibraryInfo {
  name: LibraryName;
  packageName: string;
  version: string;
  hasNativeCore: boolean;
}

export interface BenchEnvironment {
  platform: string;
  arch: string;
  osRelease: string;
  cpuModel: string;
  cpuCount: number;
  totalMemoryBytes: number;
  nodeVersion: string;
  server: string;
}

export interface BenchmarkSnapshot {
  suiteName: string;
  libraries: LibraryInfo[];
  environments: BenchEnvironment[];
  configuration: SerializedBenchConfig;
  results: BenchResult[];
  createdAt: string;
}

export interface CaseRunResult {
  elapsedMs: number;
  cpuMicroseconds: number;
  gcMilliseconds: number;
  peakMemoryBytes: number;
  latenciesMilliseconds: Float64Array;
  verificationError?: string;
}

export interface BenchmarkCase {
  name: string;
  commandsPerUnit: number;
  payloadSlotsPerUnit: number;
  executionMode?: BenchmarkMode;
  sampleCommands: Command[];
  run(context: BenchContext): Promise<CaseRunResult>;
}

export interface VerifyContext {
  unitIndex: number;
  absoluteUnitIndex: number;
  payloadAt: PayloadAccessor;
}

export type CommandVerifier = (
  unitResponses: unknown[],
  unitPayloadAt: PayloadAccessor,
  context: VerifyContext,
) => void;

export interface CommandCaseOptions {
  name: string;
  payloadSlotsPerUnit?: number;
  setup?: (
    prefix: string,
    payloadAt: PayloadAccessor,
    units: number,
  ) => Command[];
  unit: (
    prefix: string,
    unitIndex: number,
    payloadAt: PayloadAccessor,
  ) => Command[];
  verify?: CommandVerifier;
  executionMode?: BenchmarkMode;
}

export type PayloadAccessor = (unitIndex: number, slot?: number) => Buffer;

export interface PayloadPool {
  slotsPerUnit: number;
  payloads: Buffer[];
  at: PayloadAccessor;
}

export interface BenchClient {
  ping(): Promise<void>;
  execute(commands: Command[]): Promise<unknown[]>;
  cleanup(prefix: string): Promise<void>;
  close(): Promise<void>;
}
