import type {
  BenchConfig,
  BenchmarkMode,
  SerializedBenchConfig,
} from './types.ts';

function readNumber(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue || rawValue.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);

  return Number.isNaN(parsed) ? fallback : parsed;
}

function readSizes(): number[] {
  const rawValue = process.env.SOLIDIS_BENCH_SIZES ?? '1024';
  const values = rawValue
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);

  return values.length > 0 ? values : [1024, 10240, 65536];
}

function readOperations(): Set<string> | undefined {
  const rawValue = process.env.SOLIDIS_BENCH_OPERATIONS;

  if (!rawValue || rawValue.trim() === '') {
    return undefined;
  }

  const values = rawValue
    .split(',')
    .map((operation) => operation.trim())
    .filter((operation) => operation.length > 0);

  return values.length > 0 ? new Set(values) : undefined;
}

function readMode(): BenchmarkMode {
  const rawValue = process.env.SOLIDIS_BENCH_MODE?.trim().toLowerCase();

  if (rawValue === 'batch') {
    return 'batch';
  }

  return 'autopipeline';
}

export function readConfig(): BenchConfig {
  const username = process.env.SOLIDIS_TEST_USERNAME;
  const password = process.env.SOLIDIS_TEST_PASSWORD;

  return {
    target: {
      host: process.env.SOLIDIS_TEST_HOST ?? '127.0.0.1',
      port: readNumber('SOLIDIS_TEST_PORT', 6379),
      username: username && username.length > 0 ? username : undefined,
      password: password && password.length > 0 ? password : undefined,
    },
    mode: readMode(),
    sizes: readSizes(),
    iterations: Math.max(1, readNumber('SOLIDIS_BENCH_ITERATIONS', 100000)),
    warmup: Math.max(0, readNumber('SOLIDIS_BENCH_WARMUP', 1000)),
    clients: Math.max(1, readNumber('SOLIDIS_BENCH_CLIENTS', 1)),
    concurrency: Math.max(1, readNumber('SOLIDIS_BENCH_CONCURRENCY', 10000)),
    repeats: Math.max(1, readNumber('SOLIDIS_BENCH_REPEATS', 1)),
    cooldownMs: Math.max(0, readNumber('SOLIDIS_BENCH_COOLDOWN_MS', 1000)),
    operations: readOperations(),
  };
}

export function serializeConfig(config: BenchConfig): SerializedBenchConfig {
  return {
    ...config,
    operations: config.operations ? Array.from(config.operations) : undefined,
  };
}

export function deserializeConfig(config: SerializedBenchConfig): BenchConfig {
  return {
    ...config,
    operations: config.operations ? new Set(config.operations) : undefined,
  };
}
