import { ioredisAutoPipelineExcludedCommands } from './constants.ts';

import type { BenchmarkMode, Command } from '../shared/types.ts';

function getCommandName(command: Command): string {
  const name = command[0];

  if (typeof name !== 'string') {
    throw new Error(`Redis command name must be a string: ${name}`);
  }

  return name.toLowerCase();
}

function canIORedisAutoPipeline(command: Command): boolean {
  return !ioredisAutoPipelineExcludedCommands.has(getCommandName(command));
}

export function getComparableModes(
  commands: Command[],
): ReadonlySet<BenchmarkMode> {
  const modes: BenchmarkMode[] = ['batch'];

  if (commands.every(canIORedisAutoPipeline)) {
    modes.push('autopipeline');
  }

  return new Set(modes);
}

export function getNonComparableReason(
  commands: Command[],
): string | undefined {
  const excludedCommands = [
    ...new Set(
      commands
        .filter((command) => !canIORedisAutoPipeline(command))
        .map(getCommandName),
    ),
  ];

  if (excludedCommands.length === 0) {
    return undefined;
  }

  return `ioredis does not auto-pipeline command(s): ${excludedCommands.join(
    ',',
  )}`;
}
