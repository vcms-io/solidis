/**
 * Generic, dependency-free helpers shared across every test suite: timing
 * primitives, deterministic-but-unique key generation, assertion helpers,
 * and payload builders used by the binary-safety and concurrency suites.
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';

export function assertCloseTo(
  actual: number,
  expected: number,
  precision = 2,
): void {
  const tolerance = 10 ** -precision / 2;

  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be close to ${expected} (precision ${precision})`,
  );
}

export function withoutSanitizePayload(flags: string[]): string[] {
  return flags.filter((flag) => flag !== 'sanitize-payload');
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface WaitForOptions {
  timeout?: number;
  interval?: number;
  description?: string;
}

/**
 * Polls a predicate until it returns a truthy value or the timeout elapses.
 * Used by the pub/sub and streams suites where server state settles
 * asynchronously.
 */
export async function waitFor<T>(
  predicate: () => T | Promise<T>,
  options: WaitForOptions = {},
): Promise<T> {
  const timeout = options.timeout ?? 2000;
  const interval = options.interval ?? 10;
  const startedAt = Date.now();

  for (;;) {
    const result = await predicate();

    if (result) {
      return result;
    }

    if (Date.now() - startedAt > timeout) {
      throw new Error(
        `waitFor timed out after ${timeout}ms${
          options.description ? `: ${options.description}` : ''
        }`,
      );
    }

    await delay(interval);
  }
}

/** Milliseconds that `run` takes, run `times` times in a row. */
export async function measureTime(
  run: () => unknown,
  times = 1,
): Promise<number> {
  const startedAt = performance.now();

  for (let time = 0; time < times; time += 1) {
    await run();
  }

  return performance.now() - startedAt;
}

/**
 * Milliseconds of CPU time that `run` takes: the time the process spends
 * waiting, for a timer or for other processes, does not count.
 */
export async function measureCpuTime(run: () => unknown): Promise<number> {
  const usage = process.cpuUsage();

  await run();

  const { user, system } = process.cpuUsage(usage);

  return (user + system) / 1000;
}

/**
 * Asserts that a task of the larger size takes less than `limit` times as
 * long as one of the smaller size. `measure` runs the task once at a size and
 * returns the milliseconds it took. A first run, which also compiles the code
 * it runs, does not count; then each size runs up to three times and the
 * fastest runs are compared, so neither the speed nor a passing load of the
 * machine decides the outcome.
 */
export async function assertGrowth(
  measure: (size: number) => Promise<number>,
  [small, large]: [number, number],
  limit: number,
): Promise<void> {
  let smallTime = Number.POSITIVE_INFINITY;
  let largeTime = Number.POSITIVE_INFINITY;

  await measure(small);

  for (
    let round = 0;
    round < 3 && !(largeTime < smallTime * limit);
    round += 1
  ) {
    smallTime = Math.min(smallTime, await measure(small));
    largeTime = Math.min(largeTime, await measure(large));
  }

  assert.ok(
    largeTime < smallTime * limit,
    `${small}: ${smallTime.toFixed(2)} ms, ${large}: ${largeTime.toFixed(2)} ms`,
  );
}

/**
 * Builds a collision-resistant key namespace for a single suite run so that
 * concurrent suites (and repeated runs against a shared server) never clobber
 * each other.
 */
export function createKeyspace(prefix: string): {
  namespace: string;
  key: (...segments: (string | number)[]) => string;
} {
  const namespace = `solidis:test:${prefix}:${randomUUID()}`;

  return {
    namespace,
    key: (...segments) =>
      segments.length > 0 ? `${namespace}:${segments.join(':')}` : namespace,
  };
}

let monotonicCounter = 0;

export function uniqueSuffix(): string {
  monotonicCounter += 1;

  return `${Date.now().toString(36)}-${monotonicCounter.toString(36)}`;
}

export function randomString(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

export function randomBuffer(length: number): Buffer {
  return randomBytes(length);
}

/**
 * Produces an array `[0, 1, …, count - 1]`. Keeps the concurrency suites free
 * of imperative index loops while staying explicit about intent.
 */
export function range(count: number): number[] {
  return Array.from({ length: count }, (_unused, index) => index);
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let cursor = 0; cursor < items.length; cursor += size) {
    chunks.push(items.slice(cursor, cursor + size));
  }

  return chunks;
}
