import { PerformanceObserver } from 'node:perf_hooks';

import { memorySampleIntervalMs } from './constants.ts';

export interface PhaseMeasurement {
  elapsedMs: number;
  cpuMicroseconds: number;
  gcMilliseconds: number;
  peakMemoryBytes: number;
}

function readMemoryBytes(): number {
  const { heapUsed, arrayBuffers } = process.memoryUsage();

  return heapUsed + arrayBuffers;
}

export async function measurePhase(
  run: () => Promise<void>,
): Promise<PhaseMeasurement> {
  const collections: PerformanceEntry[] = [];
  const observer = new PerformanceObserver((list) => {
    collections.push(...list.getEntries());
  });

  observer.observe({ entryTypes: ['gc'] });

  const baselineMemoryBytes = readMemoryBytes();

  let peakMemoryBytes = baselineMemoryBytes;

  const sampler = setInterval(() => {
    peakMemoryBytes = Math.max(peakMemoryBytes, readMemoryBytes());
  }, memorySampleIntervalMs);
  const cpuStartedAt = process.cpuUsage();
  const startedAt = performance.now();

  try {
    await run();

    const elapsedMs = performance.now() - startedAt;
    const { user, system } = process.cpuUsage(cpuStartedAt);

    peakMemoryBytes = Math.max(peakMemoryBytes, readMemoryBytes());
    collections.push(...observer.takeRecords());

    const endedAt = startedAt + elapsedMs;

    return {
      elapsedMs,
      cpuMicroseconds: user + system,
      gcMilliseconds: collections
        .filter(
          (entry) => entry.startTime >= startedAt && entry.startTime < endedAt,
        )
        .reduce((total, entry) => total + entry.duration, 0),
      peakMemoryBytes: peakMemoryBytes - baselineMemoryBytes,
    };
  } finally {
    clearInterval(sampler);
    observer.disconnect();
  }
}
