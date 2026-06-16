export const settlePingSamples = 5;
export const settleMaxAttempts = 3;
export const settleJitterPercent = 35;
export const settleAbsoluteRangeMs = 2;
export const payloadSeedBase = 0x1d16;
export const pubSubDeliveryTimeoutBytesPerMs = 8 * 1024;

/**
 * Fairness policy: other libraries do not expose per-pipeline command caps,
 * so Solidis' protective caps are disabled for benchmark harnesses.
 */
export const unboundedPipelineLimit = Number.MAX_SAFE_INTEGER;
export const unboundedSocketWriteSize = Number.MAX_SAFE_INTEGER;
export const unboundedReplyProcessingLimit = Number.MAX_SAFE_INTEGER;

export function createNamespace(suiteName: string): string {
  return `${suiteName}:bench:${process.pid}:${Date.now()}`;
}
