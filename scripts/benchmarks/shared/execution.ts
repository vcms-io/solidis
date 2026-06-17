import { logError, logPhase, logProgress, logSuccess } from './utils.ts';
import { VerificationError } from './verification.ts';

import type { BenchmarkSuite } from './suite.ts';
import type {
  BenchClient,
  BenchmarkCase,
  Command,
  CommandCaseOptions,
  CommandVerifier,
  PayloadAccessor,
  VerifyContext,
} from './types.ts';

interface CollectedUnit {
  responses: unknown[];
  payloadOffset: number;
}

async function runCommandUnits(
  clients: BenchClient[],
  prefix: string,
  payloadOffset: number,
  units: number,
  concurrency: number,
  expectedCommandsPerUnit: number,
  build: (
    prefix: string,
    unitIndex: number,
    payloadAt: PayloadAccessor,
  ) => Command[],
  payloadAt: PayloadAccessor,
  collected: CollectedUnit[] | null,
): Promise<void> {
  if (units <= 0) {
    return;
  }

  let nextUnitIndex = 0;
  const workerCount = Math.min(clients.length * concurrency, units);

  await Promise.all(
    Array.from({ length: workerCount }, async (_, workerIndex) => {
      const client = clients[workerIndex % clients.length];

      while (nextUnitIndex < units) {
        const unitIndex = nextUnitIndex;
        nextUnitIndex += 1;
        const absoluteUnitIndex = payloadOffset + unitIndex;
        const commands = build(
          prefix,
          absoluteUnitIndex,
          (slotUnitIndex, slot) =>
            payloadAt(absoluteUnitIndex + slotUnitIndex, slot),
        );

        if (commands.length !== expectedCommandsPerUnit) {
          throw new Error(
            `Benchmark unit produced ${commands.length} commands, expected ${expectedCommandsPerUnit}`,
          );
        }

        const responses = await client.execute(commands);

        if (collected) {
          collected[unitIndex] = {
            responses,
            payloadOffset: absoluteUnitIndex,
          };
        }
      }
    }),
  );
}

async function runCommandsConcurrently(
  clients: BenchClient[],
  commands: Command[],
  concurrency: number,
): Promise<void> {
  if (commands.length === 0) {
    return;
  }

  let nextCommandIndex = 0;
  const workerCount = Math.min(clients.length * concurrency, commands.length);

  await Promise.all(
    Array.from({ length: workerCount }, async (_, workerIndex) => {
      const client = clients[workerIndex % clients.length];

      while (nextCommandIndex < commands.length) {
        const commandIndex = nextCommandIndex;
        nextCommandIndex += 1;

        await client.execute([commands[commandIndex]]);
      }
    }),
  );
}

function verifyCollectedResponses(
  collected: CollectedUnit[],
  verify: CommandVerifier,
  payloadAt: PayloadAccessor,
  name: string,
  library: string,
): string | undefined {
  let failures = 0;
  let firstError: string | undefined;

  for (let index = 0; index < collected.length; index += 1) {
    const unit = collected[index];

    if (!unit) {
      continue;
    }

    const unitPayloadAt: PayloadAccessor = (slotUnitIndex, slot) =>
      payloadAt(unit.payloadOffset + slotUnitIndex, slot);
    const context: VerifyContext = {
      unitIndex: index,
      absoluteUnitIndex: unit.payloadOffset,
      payloadAt,
    };

    try {
      verify(unit.responses, unitPayloadAt, context);
    } catch (error) {
      failures += 1;

      if (!firstError) {
        firstError =
          error instanceof VerificationError || error instanceof Error
            ? error.message
            : String(error);
      }
    }
  }

  if (failures > 0) {
    const message = `${failures}/${collected.length} units failed: ${firstError}`;

    logError(`verify ${name} [${library}]: ${message}`);

    return message;
  }

  logSuccess(`verify ${name} [${library}] ${collected.length} units`);

  return undefined;
}

export function createCommandCase(
  suite: BenchmarkSuite,
  options: CommandCaseOptions,
): BenchmarkCase {
  const samplePayloadAt = () => Buffer.alloc(0);
  const samplePrefix = 'solidis:bench:command-count';
  const sampleSetup = options.setup?.(samplePrefix, samplePayloadAt, 1) ?? [];
  const sampleUnit = options.unit(samplePrefix, 0, samplePayloadAt);
  const sampledCommands = [...sampleSetup, ...sampleUnit];
  const comparableModes = suite.getComparableModes(sampledCommands);
  const nonComparableReason = suite.getNonComparableReason(sampledCommands);
  const commandsPerUnit = sampleUnit.length;

  return {
    name: options.name,
    commandsPerUnit,
    payloadSlotsPerUnit: options.payloadSlotsPerUnit ?? 1,
    executionMode: options.executionMode,
    comparableModes,
    nonComparableReason,
    async run(context) {
      const executionMode = options.executionMode ?? context.config.mode;
      const clients =
        context.clients ??
        (await suite.createBenchClientPool(
          context.library,
          context.config.target,
          executionMode,
          context.config.clients,
        ));
      const shouldCloseClients = !context.clients;

      try {
        const setup =
          options.setup?.(
            context.keyPrefix,
            context.payloadPool.at,
            context.config.warmup + context.config.iterations,
          ) ?? [];

        logPhase(
          `prepare ${options.name} [${context.library}]`,
          `mode=${executionMode} warmup=${context.config.warmup} iterations=${context.config.iterations} concurrency=${context.config.concurrency}`,
        );

        await runCommandsConcurrently(
          clients,
          setup,
          context.config.concurrency,
        );

        const warmupStartedAt = performance.now();

        await runCommandUnits(
          clients,
          context.keyPrefix,
          0,
          context.config.warmup,
          context.config.concurrency,
          commandsPerUnit,
          options.unit,
          context.payloadPool.at,
          null,
        );

        logPhase(
          `warmup done [${context.library}]`,
          `${(performance.now() - warmupStartedAt).toFixed(1)}ms`,
        );

        const collected: CollectedUnit[] | null = options.verify
          ? new Array(context.config.iterations)
          : null;

        const startedAt = performance.now();

        await runCommandUnits(
          clients,
          context.keyPrefix,
          context.config.warmup,
          context.config.iterations,
          context.config.concurrency,
          commandsPerUnit,
          options.unit,
          context.payloadPool.at,
          collected,
        );

        const elapsedMs = performance.now() - startedAt;
        let verificationError: string | undefined;

        if (options.verify && collected) {
          verificationError = verifyCollectedResponses(
            collected,
            options.verify,
            context.payloadPool.at,
            options.name,
            context.library,
          );
        }

        return { elapsedMs, verificationError };
      } finally {
        await clients[0]?.cleanup(context.keyPrefix).catch((error) => {
          logProgress(
            `cleanup error: ${options.name} [${context.library}] ${error}`,
          );
        });

        if (shouldCloseClients) {
          await suite.closeBenchClientPool(clients);
        }
      }
    },
  };
}
