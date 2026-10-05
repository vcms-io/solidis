import { performance } from 'node:perf_hooks';

import { pubSubDeliveryTimeoutBytesPerMs } from './constants.ts';
import { measurePhase } from './measurement.ts';
import { logError, logSuccess } from './utils.ts';

import type { BenchmarkSuite } from './suite.ts';
import type { BenchContext, BenchmarkCase, CaseRunResult } from './types.ts';

const pubSubCaseName = 'pubsub:PUBLISH+MESSAGE';
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

function verifyDelivery(
  context: BenchContext,
  messages: unknown[],
  refusedPublishes: number,
): string | undefined {
  const { warmup, iterations } = context.config;
  const published = new Map<string, Buffer[]>();

  for (let index = 0; index < iterations; index += 1) {
    const payload = context.payloadPool.at(warmup + index);
    const key = payload.toString('latin1', 0, 8);
    const payloads = published.get(key);

    if (payloads) {
      payloads.push(payload);
    } else {
      published.set(key, [payload]);
    }
  }

  let unmatched = iterations - messages.length;

  for (const message of messages) {
    if (!Buffer.isBuffer(message)) {
      unmatched += 1;

      continue;
    }

    const payloads = published.get(message.toString('latin1', 0, 8)) ?? [];
    const index = payloads.findIndex((payload) => payload.equals(message));

    if (index < 0) {
      unmatched += 1;
    } else {
      payloads.splice(index, 1);
    }
  }

  const label = `verify ${pubSubCaseName} [${context.library}]`;

  if (unmatched > 0 || refusedPublishes > 0) {
    const message = `${unmatched}/${iterations} messages did not match a published payload; ${refusedPublishes} PUBLISH replies were not 1`;

    logError(`${label}: ${message}`);

    return message;
  }

  logSuccess(`${label} ${iterations} messages`);

  return undefined;
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
  const messages: unknown[] = [];
  let received = 0;
  let refusedPublishes = 0;
  let isMeasuring = false;

  subscriber.onMessage((message) => {
    if (isMeasuring && received < issuedAt.length) {
      latenciesMilliseconds[received] = performance.now() - issuedAt[received];
      messages.push(message);
    }

    received += 1;
  });

  const publish = async (publisherIndex: number, payloadOffset: number) => {
    const [receivers] = await publishers[publisherIndex].execute([
      ['PUBLISH', channel, context.payloadPool.at(payloadOffset)],
    ]);

    if (isMeasuring && Number(receivers) !== 1) {
      refusedPublishes += 1;
    }
  };

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

    const measurement = await measurePhase(() =>
      publishAndWaitForDelivery(
        context,
        context.config.iterations,
        context.config.warmup,
        () => received,
        0,
        issuedAt,
        publish,
      ),
    );

    return {
      ...measurement,
      latenciesMilliseconds,
      verificationError: verifyDelivery(context, messages, refusedPublishes),
    };
  } finally {
    await subscriber.close();
    await suite.closeBenchClientPool(publishers);
  }
}

export function createPubSubCase(suite: BenchmarkSuite): BenchmarkCase {
  return {
    name: pubSubCaseName,
    commandsPerUnit: 1,
    payloadSlotsPerUnit: 1,
    sampleCommands: [['PUBLISH', 'channel', '']],
    run(context) {
      return runPubSubBenchmark(suite, context);
    },
  };
}
