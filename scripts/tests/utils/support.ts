/**
 * Generic, dependency-free helpers shared across every test suite: timing
 * primitives, deterministic-but-unique key generation, assertion helpers,
 * and payload builders used by the binary-safety and concurrency suites.
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import type { EventEmitter } from 'node:events';

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

/**
 * Waits for `promise` and fails with `description` when it does not settle
 * within `timeout` milliseconds, so a missing event fails its own test
 * instead of the whole file.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  description: string,
  timeout = 10_000,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(`${description} did not happen within ${timeout} ms`),
          );
        }, timeout).unref();
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The arguments of the next `name` event, within `timeout` milliseconds. */
export function nextEvent(
  emitter: Pick<EventEmitter, 'once'>,
  name: string,
  timeout?: number,
): Promise<unknown[]> {
  return withTimeout(
    new Promise((resolve) => {
      emitter.once(name, (...values: unknown[]) => resolve(values));
    }),
    `The '${name}' event`,
    timeout,
  );
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

/**
 * Milliseconds that `run` takes, run `times` times in a row after a full
 * garbage collection.
 */
export async function measureTime(
  run: () => unknown,
  times = 1,
): Promise<number> {
  collectGarbage();

  const startedAt = performance.now();

  for (let time = 0; time < times; time += 1) {
    await run();
  }

  return performance.now() - startedAt;
}

/**
 * Milliseconds the event loop spends running `run` after a full garbage
 * collection, read from the high-resolution clock: the time it waits for
 * timers or I/O does not count.
 */
export async function measureBusyTime(run: () => unknown): Promise<number> {
  collectGarbage();

  const start = performance.eventLoopUtilization();

  await run();

  return performance.eventLoopUtilization(start).active;
}

/**
 * Runs a full garbage collection, so a measurement does not pay for
 * collecting what the code before it allocated.
 */
function collectGarbage(): void {
  setFlagsFromString('--expose-gc');
  runInNewContext('gc')();
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
  assert.ok(size > 0, `chunk size must be positive, got ${size}`);

  const chunks: T[][] = [];

  for (let cursor = 0; cursor < items.length; cursor += size) {
    chunks.push(items.slice(cursor, cursor + size));
  }

  return chunks;
}
