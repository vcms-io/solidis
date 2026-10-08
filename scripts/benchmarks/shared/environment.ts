import { cpus, release, totalmem } from 'node:os';

import type { BenchEnvironment } from './types.ts';

function readInfoField(info: string, field: string): string | undefined {
  return new RegExp(`^${field}:(.*)$`, 'm').exec(info)?.[1]?.trim();
}

export function describeServer(info: string): string {
  const valkeyVersion = readInfoField(info, 'valkey_version');

  return valkeyVersion
    ? `Valkey ${valkeyVersion}`
    : `Redis ${readInfoField(info, 'redis_version') ?? 'unknown'}`;
}

export function captureEnvironment(serverInfo: string): BenchEnvironment {
  const processors = cpus();

  return {
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    cpuModel: processors[0]?.model.trim() ?? 'unknown',
    cpuCount: processors.length,
    totalMemoryBytes: totalmem(),
    nodeVersion: process.version,
    server: describeServer(serverInfo),
  };
}
