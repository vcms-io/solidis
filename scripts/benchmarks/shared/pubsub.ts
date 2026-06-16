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

async function runPubSubMessages(
  total: number,
  clients: number,
  concurrency: number,
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

        await publish(clientIndex, payloadOffset);
      }
    }),
  );
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
  let received = 0;

  subscriber.onMessage(() => {
    received += 1;
  });

  const publish = (publisherIndex: number, payloadOffset: number) =>
    publishers[publisherIndex].execute([
      ['PUBLISH', channel, context.payloadPool.at(payloadOffset)],
    ]);

  try {
    await subscriber.subscribe(channel);
    received = 0;
    await runPubSubMessages(
      context.config.warmup,
      context.config.clients,
      context.config.concurrency,
      publish,
    );
    await waitForCount(
      () => received,
      context.config.warmup,
      getPubSubDeliveryTimeoutMs(context, context.config.warmup),
    );
    received = 0;

    const startedAt = performance.now();

    await runPubSubMessages(
      context.config.iterations,
      context.config.clients,
      context.config.concurrency,
      (publisherIndex, payloadOffset) =>
        publish(publisherIndex, context.config.warmup + payloadOffset),
    );
    await waitForCount(
      () => received,
      context.config.iterations,
      getPubSubDeliveryTimeoutMs(context, context.config.iterations),
    );

    return { elapsedMs: performance.now() - startedAt };
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
