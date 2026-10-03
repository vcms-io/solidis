import { performance } from 'node:perf_hooks';

import { pubSubDeliveryTimeoutBytesPerMs } from './constants.ts';

import type { BenchmarkSuite } from './suite.ts';
import type {
  BenchContext,
  BenchmarkCase,
  BenchmarkMode,
  CaseRunResult,
} from './types.ts';

interface PubSubCaseOptions {
  comparableModes?: ReadonlySet<BenchmarkMode>;
  nonComparableReason?: string;
}

const pubSubMaxInFlightPayloadBytes = 4 * 1024 * 1024;

async function runPubSubMessages(
  total: number,
  clients: number,
  concurrency: number,
  payloadOffsetStart: number,
  issuedAt: Float64Array | null,
  publish: (clientIndex: number, payloadOffset: number) => Promise<unknown>,
): Promise<void> {
  if (total <= 0) {
    return;
  }

  let nextPayloadOffset = 0;
  const workerCount = Math.min(clients * concurrency, total);

  await Promise.all(
    Array.from({ length: workerCount }, async (_, workerIndex) => {
      const clientIndex = workerIndex % clients;

      while (nextPayloadOffset < total) {
        const payloadOffset = nextPayloadOffset;
        nextPayloadOffset += 1;

        if (issuedAt) {
          issuedAt[payloadOffset] = performance.now();
        }

        await publish(clientIndex, payloadOffsetStart + payloadOffset);
      }
    }),
  );
}

function getPubSubPublishBatchSize(
  context: BenchContext,
  total: number,
): number {
  const concurrencyLimit = context.config.clients * context.config.concurrency;
  const payloadLimit = Math.floor(
    pubSubMaxInFlightPayloadBytes / Math.max(1, context.payloadBytes),
  );

  return Math.max(1, Math.min(total, concurrencyLimit, payloadLimit));
}

function getPubSubDeliveryTimeoutMs(
  context: BenchContext,
  expectedMessages: number,
): number {
  const payloadAwareTimeout = Math.ceil(
    (expectedMessages * context.payloadBytes) / pubSubDeliveryTimeoutBytesPerMs,
  );

  return Math.max(1000, context.config.cooldownMs * 20, payloadAwareTimeout);
}

async function waitForCount(
  getCount: () => number,
  expected: number,
  timeoutMs: number,
): Promise<void> {
  const startedAt = performance.now();

  while (getCount() < expected) {
    if (performance.now() - startedAt > timeoutMs) {
      throw new Error(
        `Timed out waiting for ${expected} messages; received=${getCount()}`,
      );
    }

    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function publishAndWaitForDelivery(
  context: BenchContext,
  total: number,
  payloadOffsetStart: number,
  getReceived: () => number,
  expectedStart: number,
  issuedAt: Float64Array | null,
  publish: (clientIndex: number, payloadOffset: number) => Promise<unknown>,
): Promise<void> {
  const publishBatchSize = getPubSubPublishBatchSize(context, total);
  let delivered = 0;

  while (delivered < total) {
    const batchTotal = Math.min(publishBatchSize, total - delivered);

    await runPubSubMessages(
      batchTotal,
      context.config.clients,
      context.config.concurrency,
      payloadOffsetStart + delivered,
      issuedAt?.subarray(delivered, delivered + batchTotal) ?? null,
      publish,
    );

    delivered += batchTotal;

    await waitForCount(
      getReceived,
      expectedStart + delivered,
      getPubSubDeliveryTimeoutMs(context, batchTotal),
    );
  }
}

export async function runPubSubBenchmark(
  suite: BenchmarkSuite,
  context: BenchContext,
): Promise<CaseRunResult> {
  const adapter = suite.getAdapter(context.library);
  const subscriber = await adapter.createPubSubSubscriber(
    context.config.target,
  );
  const publishers = await suite.createBenchClientPool(
    context.library,
    context.config.target,
    context.config.mode,
    context.config.clients,
  );
  const channel = `${context.keyPrefix}:channel`;
  const latenciesMilliseconds = new Float64Array(context.config.iterations);
  const issuedAt = new Float64Array(context.config.iterations);
  let received = 0;
  let isMeasuring = false;

  subscriber.onMessage(() => {
    if (isMeasuring && received < issuedAt.length) {
      latenciesMilliseconds[received] = performance.now() - issuedAt[received];
    }

    received += 1;
  });

  const publish = (publisherIndex: number, payloadOffset: number) =>
    publishers[publisherIndex].execute([
      ['PUBLISH', channel, context.payloadPool.at(payloadOffset)],
    ]);

  try {
    await subscriber.subscribe(channel);
    received = 0;
    await publishAndWaitForDelivery(
      context,
      context.config.warmup,
      0,
      () => received,
      0,
      null,
      publish,
    );
    received = 0;
    isMeasuring = true;

    const startedAt = performance.now();

    await publishAndWaitForDelivery(
      context,
      context.config.iterations,
      context.config.warmup,
      () => received,
      0,
      issuedAt,
      publish,
    );

    return {
      elapsedMs: performance.now() - startedAt,
      latenciesMilliseconds,
    };
  } finally {
    await subscriber.close();
    await suite.closeBenchClientPool(publishers);
  }
}

export function createPubSubCase(
  suite: BenchmarkSuite,
  options: PubSubCaseOptions = {},
): BenchmarkCase {
  return {
    name: 'pubsub:PUBLISH+MESSAGE',
    commandsPerUnit: 1,
    payloadSlotsPerUnit: 1,
    comparableModes: options.comparableModes ?? new Set(),
    nonComparableReason:
      options.nonComparableReason ??
      'pub/sub message delivery includes library-specific event emission and string conversion policy',
    run(context) {
      return runPubSubBenchmark(suite, context);
    },
  };
}
