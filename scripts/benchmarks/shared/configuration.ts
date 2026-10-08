import type {
  BenchConfig,
  BenchmarkMode,
  SerializedBenchConfig,
} from './types.ts';

function readInteger(value: string | undefined): number {
  const text = value?.trim() ?? '';

  return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

function readNumber(name: string, fallback: number, minimum = 0): number {
  const text = process.env[name]?.trim() ?? '';

  if (!text) {
    return fallback;
  }

  const value = readInteger(text);

  if (!(value >= minimum)) {
    throw new Error(
      `${name} must be an integer of at least ${minimum}, not '${text}'.`,
    );
  }

  return value;
}

function readSizes(): number[] {
  const text = process.env.SOLIDIS_BENCH_SIZES?.trim() ?? '';

  if (!text) {
    return [1024];
  }

  const values = text.split(',').map(readInteger);

  if (!values.every((value) => value > 0)) {
    throw new Error(
      `SOLIDIS_BENCH_SIZES must list byte counts above 0, not '${text}'.`,
    );
  }

  return values;
}

function readOperations(): Set<string> | undefined {
  const sources: string[] = [];

  const environmentValue = process.env.SOLIDIS_BENCH_OPERATIONS;

  if (environmentValue && environmentValue.trim().length > 0) {
    sources.push(environmentValue);
  }

  const commandLineArguments = process.argv
    .slice(2)
    .filter((argument) => !argument.startsWith('-'));

  for (const argument of commandLineArguments) {
    sources.push(argument);
  }

  if (sources.length === 0) {
    return undefined;
  }

  const values = sources
    .join(',')
    .split(',')
    .map((operation) => operation.trim())
    .filter((operation) => operation.length > 0);

  return values.length > 0 ? new Set(values) : undefined;
}

function readLibraries(): Set<string> | undefined {
  const names = (process.env.SOLIDIS_BENCH_LIBRARIES ?? '')
    .split(/[,\s]+/)
    .filter((name) => name.length > 0);

  return names.length > 0 ? new Set(names) : undefined;
}

function readMode(): BenchmarkMode {
  const value =
    process.env.SOLIDIS_BENCH_MODE?.trim().toLowerCase() || 'autopipeline';

  if (value !== 'autopipeline' && value !== 'batch') {
    throw new Error(
      `SOLIDIS_BENCH_MODE must be autopipeline or batch, not '${value}'.`,
    );
  }

  return value;
}

export function readConfig(): BenchConfig {
  const port = readInteger(process.env.SOLIDIS_TEST_PORT);

  if (!(port >= 1 && port <= 65_535)) {
    throw new Error(
      'Set SOLIDIS_TEST_PORT to the port of a disposable server: the benchmarks flush its data.',
    );
  }

  return {
    target: {
      host: process.env.SOLIDIS_TEST_HOST ?? '127.0.0.1',
      port,
    },
    mode: readMode(),
    sizes: readSizes(),
    iterations: readNumber('SOLIDIS_BENCH_ITERATIONS', 100000, 1),
    warmup: readNumber('SOLIDIS_BENCH_WARMUP', 1000),
    clients: readNumber('SOLIDIS_BENCH_CLIENTS', 1, 1),
    concurrency: readNumber('SOLIDIS_BENCH_CONCURRENCY', 10000, 1),
    repeats: readNumber('SOLIDIS_BENCH_REPEATS', 10, 1),
    cooldownMs: readNumber('SOLIDIS_BENCH_COOLDOWN_MS', 2500),
    operations: readOperations(),
    libraries: readLibraries(),
  };
}

export function serializeConfig(config: BenchConfig): SerializedBenchConfig {
  return {
    ...config,
    operations: config.operations ? Array.from(config.operations) : undefined,
    libraries: config.libraries ? Array.from(config.libraries) : undefined,
  };
}

export function deserializeConfig(config: SerializedBenchConfig): BenchConfig {
  return {
    ...config,
    operations: config.operations ? new Set(config.operations) : undefined,
    libraries: config.libraries ? new Set(config.libraries) : undefined,
  };
}
