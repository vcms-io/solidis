export type LibraryName = string;
export type BenchmarkMode = 'autopipeline' | 'batch';
export type SerializedBenchConfig = Omit<BenchConfig, 'operations'> & {
  operations?: string[];
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
  unitsPerSecond: number | null;
  commandsPerSecond: number | null;
  samplesMs: number[];
  caseWallMs?: number;
  comparable: boolean;
  nonComparableReason?: string;
  verificationError?: string;
  error?: string;
}

export interface ComparedResult extends BenchResult {
  baselineLibrary: LibraryName;
  baselineUnitsPerSecond: number | null;
  ratioVsBaseline: number | null;
}

export interface BenchmarkSnapshot {
  suiteName: string;
  baselineLibrary: LibraryName;
  configuration: SerializedBenchConfig;
  results: ComparedResult[];
  createdAt: string;
}

export interface CaseRunResult {
  elapsedMs: number;
  verificationError?: string;
}

export interface BenchmarkCase {
  name: string;
  commandsPerUnit: number;
  payloadSlotsPerUnit: number;
  executionMode?: BenchmarkMode;
  comparableModes: ReadonlySet<BenchmarkMode>;
  nonComparableReason?: string;
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
